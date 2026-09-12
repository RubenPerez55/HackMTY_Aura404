import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Rutas de la base de datos compartida (CSV).
# Separada del motor para que el backend del agente y el servidor MCP
# bancario puedan leerla. No mover sin actualizar mcp-agent/src/data.
# ---------------------------------------------------------------------------
RUTA_DATOS = Path(__file__).parent.parent / "data"

RUTA_CSV = RUTA_DATOS / "transacciones.csv"
RUTA_USUARIOS_BANCARIO = RUTA_DATOS / "usuarios_bancario.csv"
RUTA_TARJETAS = RUTA_DATOS / "tarjetas.csv"

# ---------------------------------------------------------------------------
# Modelo de transacción.
#
# A. Transacción: columnas realmente observadas. Todas las columnas no
#    obligatorias se normalizan al leer (ver motor/models.py). Se conservan
#    las columnas históricas `usuario` y `categoria` por compatibilidad con
#    los CSV existentes y con el backend TypeScript.
# ---------------------------------------------------------------------------
COLUMNAS = [
    # obligatorias / base
    "id_transaccion",
    "usuario",                    # histórico: alias de usuario_origen
    "fecha",
    "monto",
    "categoria",                  # histórico: alias de categoria_original
    "descripcion",
    # modelado real de la operación
    "estatus",                    # pending | posted | reversed
    "moneda",                     # MXN por defecto
    "direccion",                  # debit | credit
    "referencia",
    "usuario_origen",
    "cuenta_origen",
    "contraparte_nombre",
    "contraparte_cuenta",
    "contraparte_banco",
    "id_tarjeta",
    "saldo_despues",
    "categoria_original",
]

COLUMNAS_USUARIO = [
    "usuario",
    "fecha_afiliacion",
    "ingreso_mensual",
    "saldo_ahorro",
    "saldo_disponible",           # saldo de la cuenta de débito (liquidez real)
    "fecha_nomina",               # próxima dispersión de nómina (ISO)
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

# ---------------------------------------------------------------------------
# Zona horaria / normalización de fechas.
# ---------------------------------------------------------------------------
ZONA_HORARIA = os.environ.get("MOTOR_TZ", "America/Mexico_City")

# ---------------------------------------------------------------------------
# Catálogo de contrapartes conocidas (normalización de comercio).
# La coincidencia intenta los patrones en orden; el primero que pegue gana.
# El fallback de texto normaliza mayúsculas/puntuación/espacios.
# ---------------------------------------------------------------------------
MERCHANT_CATALOG = [
    {
        "merchant": "CFE",
        "category": "utilities",
        "concept": "electricity",
        "patterns": [
            "CFE SUMINISTRADOR",
            "COMISION FEDERAL DE ELECTRICIDAD",
            "CFE",
        ],
    },
    {
        "merchant": "Telmex",
        "category": "telecom",
        "concept": "internet_landline",
        "patterns": ["TELMEX"],
    },
    {
        "merchant": "Telcel",
        "category": "telecom",
        "concept": "mobile",
        "patterns": ["TELCEL"],
    },
    {
        "merchant": "Naturgy",
        "category": "utilities",
        "concept": "gas",
        "patterns": ["NATURGY", "GAS NATURAL"],
    },
    {
        "merchant": "Netflix",
        "category": "subscriptions",
        "concept": "entertainment",
        "patterns": ["NETFLIX"],
    },
    {
        "merchant": "Spotify",
        "category": "subscriptions",
        "concept": "entertainment",
        "patterns": ["SPOTIFY"],
    },
    {
        "merchant": "Amazon",
        "category": "commerce",
        "concept": "marketplace",
        "patterns": ["AMAZON"],
    },
    {
        "merchant": "Walmart",
        "category": "commerce",
        "concept": "retail",
        "patterns": ["WALMART", "SUPERAMA", "SUPERCENTRO"],
    },
    {
        "merchant": "OXXO",
        "category": "commerce",
        "concept": "convenience",
        "patterns": ["OXXO"],
    },
    {
        "merchant": "Liverpool",
        "category": "commerce",
        "concept": "retail",
        "patterns": ["LIVERPOOL"],
    },
    {
        "merchant": "Chicken Delicias",
        "category": "dining",
        "concept": "restaurant",
        "patterns": ["CHICKEN DELICIAS", "CHICKEN"],
    },
]

# ---------------------------------------------------------------------------
# Detección de recurrencia (determinista y explicable).
# ---------------------------------------------------------------------------
RECURRENCE_MIN_PREVIOUS = 2        # mínimo de ocurrencias previas para recurrencia
RECURRENCE_STRONG_PREVIOUS = 3     # a partir de aquí la recurrencia es sólida
RECURRENCE_MAX_INTERVAL_CV = 0.35  # coeficiente de variación de intervalos "consistente"
RECURRENCE_AMOUNT_CV_TOLERANCE = 0.30  # dispersión razonable de montos
RECURRENCE_STRONG_SCORE = 0.55     # score mínimo para considerar recurrencia "suficiente"

# Frecuencias derivadas del intervalo mediano en días.
FREQUENCY_BANDS = [
    (21, "weekly"),
    (45, "monthly"),
    (80, "bimonthly"),
    (200, "quarterly"),
    (400, "annual"),
]

# ---------------------------------------------------------------------------
# Regla 1: pico de servicio recurrente.
# ---------------------------------------------------------------------------
SERVICE_SPIKE_MIN_PERCENT = 40.0         # incremento >= 40% sobre la referencia
SERVICE_SPIKE_MIN_HISTORY = 3            # muestras previas mínimas
SERVICE_SPIKE_MIN_SCORE = RECURRENCE_STRONG_SCORE
SERVICE_CATEGORIES = {"utilities", "telecom", "subscriptions", "services"}

# Umbral $5,000 como señal auxiliar, NO como criterio principal.
UMBRAL_COBRO_INDIVIDUAL = 5000.0

# Detección estadística genérica (señal auxiliar, no sustituto del análisis
# por servicio). Se conserva por compatibilidad pero deja de ser la fuente.
Z_SCORE_PICO = 2.5
STD_MINIMA_PICO = 200.0
MULTIPLO_PICO = 3.0
UMBRAL_VENTANA_7_DIAS = 12000.0
MULTIPLO_BASELINE_7_DIAS = 3.0

# ---------------------------------------------------------------------------
# Regla 2: anualidad ya cobrada.
# ---------------------------------------------------------------------------
ANNUAL_FEE_PATTERNS = ["ANUALIDAD", "COMISION ANUAL", "MEMBRESIA ANUAL", "COMISION POR MANEJO DE CUENTA"]
ANNUAL_FEE_CATEGORIES = {"annual_fee", "fees"}

# ---------------------------------------------------------------------------
# Regla 3: shock de liquidez.
# ---------------------------------------------------------------------------
LIQUIDITY_CONSUMPTION_RATE = 0.75        # dispara si consume >= 75% del saldo
LIQUIDITY_CRITICAL_RATE = 0.90           # severidad crítica si consume >= 90%
DAILY_NEED_FRACTION = 0.25               # necesidad diaria estimada = ingreso/30 * fracción
DEFAULT_DAILY_NEED = 250.0               # fallback si no hay ingreso mensual
PAYROLL_FALLBACK_DAY = 15                # día de nómina si falta fecha_nomina

# ---------------------------------------------------------------------------
# Agrupación de impactos combinados (misma persona/cuenta).
# ---------------------------------------------------------------------------
IMPACT_WINDOW_DAYS = 1                   # ventana: misma fecha contable
IMPACT_WINDOW_HOURS = 24                 # alternativo: 24 horas

# ---------------------------------------------------------------------------
# Severidad (determinista; el LLM no decide).
# ---------------------------------------------------------------------------
SEVERITY_REASONS = {
    "critical_negative_balance": "El saldo posterior al cargo es negativo",
    "critical_projected_shortfall": "El faltante proyectado hasta la nómina es crítico",
    "critical_consumption": "El cargo consume al menos el 90% del saldo disponible",
    "high_consumption": "El cargo consume al menos el 75% del saldo disponible",
    "high_multiple_signals": "La transacción genera dos o más señales relevantes",
    "high_insufficient_until_payroll": "El saldo posterior es insuficiente hasta la próxima nómina",
    "medium_service_spike": "Pico de servicio recurrente mayor o igual a 40%",
    "medium_annual_fee": "Anualidad cobrada sin shock de liquidez",
    "low_aux": "Señal auxiliar sin impacto fuerte",
}

# ---------------------------------------------------------------------------
# Publicador HTTP al backend (POST /api/triggers/impact).
# ---------------------------------------------------------------------------
MOTOR_BACKEND_URL = os.environ.get("MOTOR_BACKEND_URL", "http://127.0.0.1:4000")
MOTOR_PUBLISH_TIMEOUT = float(os.environ.get("MOTOR_PUBLISH_TIMEOUT", "5"))
MOTOR_PUBLISH_MAX_RETRIES = int(os.environ.get("MOTOR_PUBLISH_MAX_RETRIES", "3"))
MOTOR_PUBLISH_BACKOFF = float(os.environ.get("MOTOR_PUBLISH_BACKOFF", "0.5"))
MOTOR_PUBLISH_ENABLED = os.environ.get("MOTOR_PUBLISH_ENABLED", "1") not in {"0", "false", "False"}
MOTOR_PUBLISH_REQUIRED = os.environ.get("MOTOR_PUBLISH_REQUIRED", "0") not in {"0", "false", "False"}

# ---------------------------------------------------------------------------
# Watcher.
# ---------------------------------------------------------------------------
# auto | native | polling. `polling` evita fallos del watcher nativo (FSEvents)
# en algunos entornos macOS y es lo más estable para el demo.
MOTOR_OBSERVER = os.environ.get("MOTOR_OBSERVER", "polling").lower()
MOTOR_POLL_INTERVAL = float(os.environ.get("MOTOR_POLL_INTERVAL", "1.0"))

# Duración máxima (en eventos) del buffer de diagnóstico en consola.
MOTOR_LOG_BUFFER = int(os.environ.get("MOTOR_LOG_BUFFER", "200"))