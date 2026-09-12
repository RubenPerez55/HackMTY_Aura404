from pathlib import Path

# Base de datos compartida (CSV) — separada del motor para que el backend
# del agente y el servidor MCP bancario (servicio externo) puedan leerla.
RUTA_DATOS = Path(__file__).parent.parent / "data"

RUTA_CSV = RUTA_DATOS / "transacciones.csv"
RUTA_USUARIOS_BANCARIO = RUTA_DATOS / "usuarios_bancario.csv"
RUTA_TARJETAS = RUTA_DATOS / "tarjetas.csv"

COLUMNAS = ["id_transaccion", "usuario", "fecha", "categoria", "monto", "descripcion"]

COLUMNAS_USUARIO = [
    "usuario",
    "fecha_afiliacion",
    "ingreso_mensual",
    "saldo_ahorro",
    "deuda_total",
    "pagos_atrasados",
    "puntos_fidelidad",
    "nivel_fidelidad",
    "score_crediticio",
    "historial_crediticio",
]

COLUMNAS_TARJETA = [
    "id_tarjeta",
    "usuario",
    "tipo",
    "marca",
    "numero_enmascarado",
    "vencimiento",
    "estatus",
    "limite_credito",
    "saldo_utilizado",
]

USUARIOS = [
    "Ruben Perez",
    "Hector Barrera",
    "Hector Castro",
    "Javier Ortiz",
]

CATEGORIAS = [
    "Comida",
    "Transporte",
    "Entretenimiento",
    "Servicios",
    "Compras",
    "Salud",
    "Renta",
    "Otros",
]

Z_SCORE_PICO = 2.5
STD_MINIMA_PICO = 200.0
MULTIPLO_PICO = 3.0

UMBRAL_COBRO_INDIVIDUAL = 5000.0
UMBRAL_VENTANA_7_DIAS = 12000.0
MULTIPLO_BASELINE_7_DIAS = 3.0