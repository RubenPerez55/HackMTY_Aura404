import sys
import threading
import time
from pathlib import Path

import pandas as pd
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from agent import notificar_transaccion_procesada, procesar_evento
from analytics import _historial_usuario, evaluar_transaccion
from banca import cargar_todo, contexto_usuario
from config import COLUMNAS, RUTA_CSV

BANNER = f"""
{chr(0x1b)}[96m{'=' * 64}{chr(0x1b)}[0m
{chr(0x1b)}[1m{chr(0x1b)}[96m  MOTOR DE DETECCIÓN DE IMPACTO FINANCIERO{chr(0x1b)}[0m
{chr(0x1b)}[96m  Escuchando: {RUTA_CSV.name}{chr(0x1b)}[0m
{chr(0x1b)}[96m  Modo: Event-Driven (watchdog){chr(0x1b)}[0m
{'=' * 64}
  Reglas activas:
    • SPENDING_SPIKE_DETECTED  → Z-Score > 2.5 por categoría
    • LIQUIDITY_SHOCK_DETECTED → cobro ≥ $5,000 MXN o ventana 7d ≥ $12,000 MXN
  Ctrl+C para detener.
"""


class MotorDeteccion(FileSystemEventHandler):
    def __init__(self, path: Path = RUTA_CSV):
        self.path = path
        if not path.exists():
            sys.exit(f"No existe el archivo {path}. Ejecuta primero: python data_gen.py")
        self._df = pd.read_csv(path, dtype={"monto": float})
        self._lineas_vistas: set[int] = self._ids_iniciales()
        self._lock = threading.Lock()
        usuarios_bancario, tarjetas = cargar_todo()
        self._contextos = {
            u: contexto_usuario(u, usuarios_bancario, tarjetas) for u in usuarios_bancario["usuario"]
        } if not usuarios_bancario.empty else {}

    def _ids_iniciales(self) -> set[int]:
        return set(self._df["id_transaccion"].astype(int).tolist())

    def on_modified(self, event) -> None:
        if event.event_type == "modified" and event.src_path.endswith(self.path.name):
            self._procesar_nuevas()

    def on_created(self, event) -> None:
        if event.src_path.endswith(self.path.name):
            self._procesar_nuevas()

    def _procesar_nuevas(self) -> None:
        with self._lock:
            try:
                self._df = pd.read_csv(self.path, dtype={"monto": float})
            except (pd.errors.EmptyDataError, FileNotFoundError):
                return

            candidatas = self._df[
                ~self._df["id_transaccion"].astype(int).isin(self._lineas_vistas)
            ]
            if candidatas.empty:
                return

            for _, fila in candidatas.iterrows():
                txn = fila.to_dict()
                self._lineas_vistas.add(int(txn["id_transaccion"]))
                self._evaluar(txn)

    def _evaluar(self, txn: dict) -> None:
        usuario = str(txn["usuario"]).strip()
        historial = _historial_usuario(self._df, usuario)
        alertas = evaluar_transaccion(pd.Series(txn), historial)

        if alertas:
            contexto = self._contextos.get(usuario)
            for evento in alertas:
                evento["contexto"] = contexto
                print(f"\n{chr(0x1b)}[1m{chr(0x1b)}[93m[EVENTO DETECTADO]{chr(0x1b)}[0m nueva transacción #{txn['id_transaccion']}")
                procesar_evento(evento)
        else:
            notificar_transaccion_procesada(txn)


def main() -> None:
    print(BANNER)
    motor = MotorDeteccion()

    observer = Observer()
    observer.schedule(motor, str(RUTA_CSV.parent), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nMotor detenido.")
    observer.join()


if __name__ == "__main__":
    main()