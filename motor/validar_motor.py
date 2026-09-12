"""
Validación del MOTOR de detección de impacto financiero.

Responde a las preguntas:
  - ¿"X usuario" tiene estos datos?          → ficha bancaria + resumen de historial
  - Si llega esta transacción, ¿pasa esto y
    esto por qué motivo?                      → casos simulados evaluados con las
                                                MISMAS reglas que corre el motor

Nada se escribe: las transacciones simuladas (ids 99000+) se evalúan en memoria
contra el historial real de `../data/transacciones.csv`.

Uso:
    python validar_motor.py                     # informe legible para los 4 usuarios
    python validar_motor.py --usuario "Ruben Perez"
    python validar_motor.py --fecha 2026-09-12 12:00:00   # fecha de la tx simulada
    python validar_motor.py --json              # salida JSON (para backend / MCP)
"""

import argparse
import json
import sys
from datetime import datetime

import pandas as pd

from analytics import _historial_usuario, evaluar_transaccion
from banca import cargar_todo, contexto_usuario
from config import (
    MULTIPLO_BASELINE_7_DIAS,
    MULTIPLO_PICO,
    STD_MINIMA_PICO,
    UMBRAL_COBRO_INDIVIDUAL,
    UMBRAL_VENTANA_7_DIAS,
    USUARIOS,
    Z_SCORE_PICO,
)

RESET = "\033[0m"
BOLD = "\033[1m"
ROJO = "\033[91m"
AMARILLO = "\033[93m"
CIAN = "\033[96m"
VERDE = "\033[92m"
GRIS = "\033[90m"


def _fmt(valor: float | None, simbolo="$", dec=2) -> str:
    if valor is None:
        return "Sin dato"
    return f"{simbolo}{valor:,.{dec}f} MXN" if simbolo == "$" else f"{valor:,.{dec}f}"


def _caso(usuario, moneda=False):
    """Construye una transacción simulada completa en forma de Series pandas."""
    def hacer(cid: int, fecha: str, categoria: str, monto: float, descripcion: str) -> pd.Series:
        return pd.Series({
            "id_transaccion": cid,
            "usuario": usuario,
            "fecha": fecha,
            "categoria": categoria,
            "monto": float(monto),
            "descripcion": descripcion,
        })
    return hacer


def _categoria_base(historial: pd.DataFrame):
    """Categoría estable (n>=5 y σ>0) para generar casos de pico."""
    if historial.empty:
        return None
    by_cat = historial.groupby("categoria")["monto"]
    for categoria, g in by_cat:
        if len(g) >= 5 and float(g.std(ddof=1)) > 0:
            return str(categoria), float(g.mean()), float(g.std(ddof=1)), len(g)
    return None


def _umbral_spike(media: float, std: float) -> tuple[float, str]:
    if std < STD_MINIMA_PICO:
        return MULTIPLO_PICO * media, f"σ<{STD_MINIMA_PICO:.0f}: umbral = {MULTIPLO_PICO:.0f}× media"
    return media + Z_SCORE_PICO * std, f"media + {Z_SCORE_PICO:.1f}×σ"


def _ventana(historial: pd.DataFrame, fecha: str) -> tuple[float, float, float]:
    """(monto sugerido, suma previa 7d, umbral efectivo) para el caso ventana."""
    fecha_dt = pd.to_datetime(fecha)
    if "fecha_dt" not in historial.columns:
        historial = historial.copy()
        historial["fecha_dt"] = pd.to_datetime(historial["fecha"])
    hoy = fecha_dt.date()
    sin_hoy = historial[historial["fecha_dt"].dt.date != hoy]
    baseline = sin_hoy.sort_values("fecha_dt").tail(7)["monto"].astype(float)
    suma = float(baseline.sum()) if len(baseline) else 0.0
    media_diaria = float(baseline.mean()) if len(baseline) else 0.0
    umbral = max(UMBRAL_VENTANA_7_DIAS, MULTIPLO_BASELINE_7_DIAS * media_diaria * 7)
    restante = umbral - suma
    # monto suficiente para cruzar el umbral efectivo y demostrar el disparo
    monto = round(restante + 100, 2) if restante > 0 else 1200.0
    return monto, suma, umbral


def _explicar(evento: dict) -> list[str]:
    """Traduce un evento del motor a un 'por qué' legible."""
    if evento["event"] == "SPENDING_SPIKE_DETECTED":
        m = evento["monto"]
        umbral = float(evento["umbral"])
        media = float(evento["media_historica"])
        motivo = (
            f"supera el umbral de {_fmt(umbral)} para la categoría "
            f"'{evento['categoria']}' (media histórica {_fmt(media)})"
        )
        if not str(evento.get("z_score", "")).startswith(">"):
            motivo += f", z-score {evento['z_score']}"
        motivo += f" → margen {_fmt(evento['margen'])}"
        return [motivo]
    if evento["event"] == "LIQUIDITY_SHOCK_DETECTED":
        return [f"- {d['detalle']}" for d in evento.get("detalles", [])]
    return []


def _evaluar_casos(usuario: str, fecha: str) -> dict:
    df = pd.read_csv(_csv(), dtype={"monto": float})
    historial = _historial_usuario(df, usuario)
    nueva = _caso(usuario)
    base = _categoria_base(historial)

    casos = []

    if base:
        categoria, media, std, n = base
        umbral, _explicacion_umbral = _umbral_spike(media, std)

        # 1) tx normal (negativo): muy por debajo de todo
        txn = nueva(99001, fecha, categoria, round(0.5 * media, 2), f"Pago habitual en {categoria}")
        casos.append(_correr(txn, historial, f"normal · {categoria} (media {_fmt(media)}, n={n})"))

        # 2) pico de gasto (positivo): ~4σ por encima de la media
        monto_spike = (
            round(media + 4 * std, 2)
            if std >= STD_MINIMA_PICO
            else round(MULTIPLO_PICO * media + max(media, 50), 2)
        )
        txn = nueva(99002, fecha, categoria, monto_spike, f"Compra inusual en {categoria}")
        casos.append(_correr(txn, historial, f"spike_de_gasto · {categoria} (umbral {_fmt(umbral)})"))

    # 3) cobro individual (positivo): cuota fuerte >= umbral crítico
    txn = nueva(99003, fecha, "Otros", 6800.0, "Disposición en efectivo / pago punta")
    casos.append(_correr(txn, historial, "cobro_individual (≥ " + f"{UMBRAL_COBRO_INDIVIDUAL:,.0f})"))

    # 4) ventana móvil 7 días (positivo): acumulado que cruza el umbral
    monto_v, suma_v, umbral_v = _ventana(historial, fecha)
    txn = nueva(99004, fecha, "Otros", monto_v, "Gasto acumulado de fin de semana")
    casos.append(_correr(txn, historial, f"ventana_7_dias (suma previa {_fmt(suma_v)} vs {_fmt(umbral_v)})"))

    return {
        "usuario": usuario,
        "fecha_simulada": fecha,
        "resumen_historial": _resumen_historial(historial),
        "casos": casos,
    }


def _correr(txn: pd.Series, historial: pd.DataFrame, etiqueta: str) -> dict:
    alertas = evaluar_transaccion(txn, historial)
    return {
        "caso": etiqueta,
        "id": int(txn["id_transaccion"]),
        "fecha": txn["fecha"],
        "categoria": txn["categoria"],
        "monto": float(txn["monto"]),
        "descripcion": txn["descripcion"],
        "alertas": [
            {"event": a["event"], "motivo": _explicar(a), **_detalle(a)} for a in alertas
        ],
    }


def _detalle(a: dict) -> dict:
    extra = {}
    for k in ("categoria", "media_historica", "umbral", "z_score", "margen"):
        if k in a:
            extra[k] = a[k]
    return extra


def _csv():
    from config import RUTA_CSV
    return RUTA_CSV


def _resumen_historial(historial: pd.DataFrame) -> dict:
    if historial.empty:
        return {"n": 0}
    montos = historial["monto"].astype(float)
    return {
        "n": len(historial),
        "primera": str(historial["fecha"].min()),
        "ultima": str(historial["fecha"].max()),
        "media_general": round(float(montos.mean()), 2),
        "total_gastado": round(float(montos.sum()), 2),
        "categorias": {
            str(c): {"n": int(n), "media": round(float(m), 2)}
            for c, (n, m) in historial.groupby("categoria")["monto"]
            .agg(["count", "mean"])
            .iterrows()
        },
    }


def _ficha(usuario: str) -> dict:
    usuarios, tarjetas = cargar_todo()
    return contexto_usuario(usuario, usuarios, tarjetas) or {}


# ------------------------- salida legible -------------------------


def _imprimir_ficha(ctx: dict) -> None:
    print(f"\n{BOLD}{CIAN}── FICHA BANCARIA · {ctx.get('usuario')} ──{RESET}")
    print(
        f"  ingreso {_fmt(ctx.get('ingreso_mensual'))} · ahorro {_fmt(ctx.get('saldo_ahorro'))} · "
        f"deuda {_fmt(ctx.get('deuda_total'))} · atrasos {ctx.get('pagos_atrasados')}"
    )
    print(
        f"  fidelidad {ctx.get('nivel_fidelidad') or '—'} ({_fmt(ctx.get('puntos_fidelidad'), '')} pts) · "
        f"score {_fmt(ctx.get('score_crediticio'), '')} · historial {ctx.get('historial_crediticio') or '—'}"
    )
    activas = ctx.get("tarjetas_activas", [])
    print(f"  tarjetas activas: {ctx.get('credito_activas', 0)} crédito / {ctx.get('debito_activas', 0)} débito")
    for t in activas:
        print(f"      • {t['marca']} {t['tipo']} · {t['numero_enmascarado']} (venc. {t['vencimiento']})")


def _imprimir_casos(resultado: dict) -> None:
    hist = resultado["resumen_historial"]
    print(
        f"\n{BOLD}{CIAN}── HISTORIAL · {resultado['usuario']} ──{RESET}  "
        f"{hist['n']} tx · {hist['primera']} → {hist['ultima']} · media {_fmt(hist['media_general'])}"
    )
    for caso in resultado["casos"]:
        n_alertas = len(caso["alertas"])
        estado = f"{ROJO}⚠ {n_alertas} ALERTA(S){RESET}" if n_alertas else f"{VERDE}✔ sin anomalías{RESET}"
        print(
            f"\n  {BOLD}#{caso['id']}{RESET} [{GRIS}{caso['caso']}{RESET}] "
            f"{_fmt(caso['monto'])} · {caso['categoria']} · {caso['fecha']}  →  {estado}"
        )
        for a in caso["alertas"]:
            print(f"      {BOLD}{AMARILLO}{a['event']}{RESET}")
            for motivo in a["motivo"]:
                print(f"        {GRIS}por qué:{RESET} {motivo}")


def _imprimir_informe(usuario: str, fecha: str) -> None:
    print(f"{BOLD}{'='*72}{RESET}")
    print(f"{BOLD}  MOTOR · VALIDACIÓN · usuario: {usuario}{RESET}")
    print(f"{BOLD}{'='*72}{RESET}")
    ficha = _ficha(usuario)
    _imprimir_ficha(ficha)
    resultado = _evaluar_casos(usuario, fecha)
    _imprimir_casos(resultado)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validación del motor de impacto financiero")
    parser.add_argument("--usuario", default=None, help="Solo un usuario (por defecto: los 4)")
    parser.add_argument("--fecha", default=None, help="fecha de las tx simuladas (ISO o YYYY-MM-DD HH:MM:SS)")
    parser.add_argument("--json", action="store_true", help="salida JSON")
    args = parser.parse_args()

    fecha = args.fecha or datetime.today().strftime("%Y-%m-%d")
    usuarios = [args.usuario] if args.usuario else USUARIOS
    if args.usuario and args.usuario not in USUARIOS:
        print(f"Error: el usuario '{args.usuario}' no está entre los 4 mock: {USUARIOS}", file=sys.stderr)
        sys.exit(2)

    if args.json:
        payload = {"usuarios": [_evaluar_casos(u, fecha) for u in usuarios]}
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    for u in usuarios:
        _imprimir_informe(u, fecha)
    print(
        f"\n{GRIS}✔ Validación en memoria — no se escribió nada en {_csv()}{RESET}\n"
    )


if __name__ == "__main__":
    main()