"""Orquestador del motor ShockAbsorber.

Vigila `data/transacciones.csv` y evalua cada transaccion nueva (posted/debit)
contra su historico, excluyendo la transaccion actual. Publica los impactos
combinados al backend via HTTP.

Uso:
    python motor.py                # watcher continuo
    python motor.py --once         # evalua filas nuevas y sale
    python motor.py --scan-all     # evalua TODO el CSV y sale (sin spinner)
    MOTOR_OBSERVER=polling python motor.py   # fuerza watcher por polling
"""
from __future__ import annotations

import argparse
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

from config import (
    MOTOR_LOG_BUFFER,
    MOTOR_POLL_INTERVAL,
    RUTA_CSV,
)
from models import (
    Transaction,
    leer_usuarios,
    leer_tarjetas,
    leer_transacciones,
    migrar_csv,
)
from publisher import publicar_trigger
from triggers import agregar_impactos, evaluar_transaccion

logger = logging.getLogger("motor")

try:  # watchdog opcional
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
    from watchdog.observers.polling import PollingObserver as WatchdogPollingObserver
except ImportError:  # pragma: no cover
    FileSystemEventHandler = None
    Observer = None
    WatchdogPollingObserver = None


def evaluar_transacciones(
    transacciones: List[Transaction],
    contexto_usuarios: Dict[str, Dict[str, str]],
    tarjetas: List[Dict[str, str]],
    publicar: bool = True,
    ids_ya_publicados: Optional[Set[str]] = None,
) -> List[Dict]:
    """Evalua transacciones nuevas (posted debits) y publica impactos combinados.

    Se excluye la transaccion evaluada del historial (requisito del motor:
    el pico se mide contra el resto del historico, no contra si misma).
    """
    publicados = set(ids_ya_publicados or ())
    impacto_resultados: List[Dict] = []

    # Index count of "new" tx (by id), to iterate only those not seen.
    nuevas = [t for t in transacciones if t.id_transaccion not in publicados]

    for tx in nuevas:
        if not tx.es_debito or not tx.esta_posted:
            continue
        usuario = tx.usuario
        contexto = contexto_usuarios.get(usuario, {})
        # Historico = TODO el CSV excepto la transaccion actual.
        historico = [t for t in transacciones if t.id_transaccion != tx.id_transaccion]
        fact = evaluar_transaccion(tx, historico, contexto)
        if fact:
            impacto_resultados.append(fact)
        publicados.add(tx.id_transaccion)

    combinados = agregar_impactos(impacto_resultados)

    if publicar:
        for impacto in combinados:
            publicar_trigger(impacto)

    return combinados


def _refrescar_contexto() -> Dict[str, Dict[str, str]]:
    """Siempre lee del CSV actual (sin cache de arranque)."""
    return leer_usuarios()


def _imprimir_impacto(impacto: Dict, buffer: List[str]) -> None:
    sev = impacto["severidad"].upper()
    tipos = ", ".join(impacto["disparado"])
    monto = impacto.get("montos", {}).get("monto", impacto.get("monto", 0))
    uid = impacto.get("userId", "")
    day = impacto.get("fecha", "")[:10]
    lineas = [
        f"[{datetime.now():%H:%M:%S}] IMPACTO {sev} | {tipos} | ${monto:,.0f} MXN | {uid} | {day}",
        f"  groupId={impacto.get('groupId')} eventId={impacto.get('eventId')}",
    ]
    for razon in impacto.get("razonesSeveridad", [])[:3]:
        lineas.append(f"  - {razon}")
    texto = "\n".join(lineas)
    buffer.append(texto)
    if len(buffer) > MOTOR_LOG_BUFFER:
        del buffer[: len(buffer) - MOTOR_LOG_BUFFER]
    print(texto, flush=True)


def analizar_archivo(publicar: bool = True) -> List[Dict]:
    """Lee el CSV, migra encabezados, evalua nuevas transacciones."""
    migrar_csv()
    trasacciones = leer_transacciones()
    contexto = _refrescar_contexto()
    tarjetas = leer_tarjetas()
    combinados = evaluar_transacciones(
        trasacciones,
        contexto,
        tarjetas,
        publicar=publicar,
        ids_ya_publicados=set(),
    )
    return combinados


def esperar_cambios_csv(ruta: Path, procesados: Set[str]) -> List[Dict]:
    """Procesa filas nuevas en CSV (snapshot vigila-cambios)."""
    trasacciones = leer_transacciones(ruta)
    nuevas = [t for t in trasacciones if t.id_transaccion not in procesados]
    if not nuevas:
        return []

    contexto = _refrescar_contexto()
    tarjetas = leer_tarjetas()
    combinados = evaluar_transacciones(
        trasacciones,
        contexto,
        tarjetas,
        publicar=True,
        ids_ya_publicados=procesados,
    )

    # Marcar como procesadas SOLO las que efectivamente se publicaron
    # (o que no dispararon nada pero ya vimos).
    for tx in nuevas:
        procesados.add(tx.id_transaccion)

    buffer_local: List[str] = []
    for impacto in combinados:
        _imprimir_impacto(impacto, buffer_local)
    return combinados


def _watcher_polling(csv_path: Path, interval: float) -> None:
    import csv as _csv

    procesados: Set[str] = set()
    print(f"[motor] watcher polling activo ({interval:g}s) en {csv_path}", flush=True)
    snapshot = _leer_ids(csv_path)
    procesados.update(snapshot)
    print(f"[motor] {len(snapshot)} transacciones ya en archivo.", flush=True)

    try:
        while True:
            try:
                ids_actuales = _leer_ids(csv_path)
                nuevas = ids_actuales - procesados
                if nuevas:
                    esperar_cambios_csv(csv_path, procesados)
                else:
                    time.sleep(interval)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # pragma: no cover
                print(f"[motor] error en polling: {exc}", flush=True)
                time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[motor] detenido.", flush=True)


def _leer_ids(csv_path: Path) -> Set[str]:
    import csv as _csv

    ids: Set[str] = set()
    if not csv_path.exists():
        return ids
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        for fila in _csv.DictReader(f):
            tid = (fila.get("id_transaccion") or "").strip()
            if tid and tid not in ids:
                ids.add(tid)
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description="Motor ShockAbsorber (watcher).")
    parser.add_argument("--once", action="store_true", help="evalua filas nuevas y sale")
    parser.add_argument("--scan-all", action="store_true", help="evalua todo el CSV (dev)")
    parser.add_argument("--csv", type=Path, default=RUTA_CSV, help="ruta del CSV")
    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING, format="%(name)s %(levelname)s %(message)s")

    migrar_csv()

    if args.scan_all:
        combinados = analizar_archivo(publicar=False)
        buffer_local: List[str] = []
        for impacto in combinados:
            _imprimir_impacto(impacto, buffer_local)
        print(f"[motor] scan-all: {len(combinados)} impacto(s) detectado(s).")
        return

    if args.once:
        combinados = analizar_archivo()
        print(f"[motor] once: {len(combinados)} impacto(s) publicado(s).")
        return

    _watcher_polling(args.csv, MOTOR_POLL_INTERVAL)


if __name__ == "__main__":
    main()