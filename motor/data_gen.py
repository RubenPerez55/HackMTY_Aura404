import datetime as dt
import random

import pandas as pd
from faker import Faker

from config import (
    CATEGORIAS,
    COLUMNAS,
    COLUMNAS_TARJETA,
    COLUMNAS_USUARIO,
    RUTA_CSV,
    RUTA_TARJETAS,
    RUTA_USUARIOS_BANCARIO,
    USUARIOS,
)

fake = Faker("es_MX")

PERFILES_MONTO = {
    "Comida": (80, 600),
    "Transporte": (50, 500),
    "Entretenimiento": (100, 800),
    "Servicios": (300, 2500),
    "Compras": (200, 3000),
    "Salud": (150, 2000),
    "Renta": (6000, 14000),
    "Otros": (50, 1000),
}

# Un caso de prueba distinto por usuario:
#   1. Ruben Perez   -> perfil premium completo (puntos, score, tarjetas activas)
#   2. Hector Barrera-> SIN puntos de fidelidad (0, nivel Básico)
#   3. Hector Castro -> SIN tarjetas activas (todas canceladas/vencidas)
#   4. Javier Ortiz  -> SIN historial crediticio, SIN tarjetas y SIN puntos
PERFILES_BANCARIOS = [
    {
        "usuario": "Ruben Perez",
        "fecha_afiliacion": "2023-05-14",
        "ingreso_mensual": 45000.0,
        "saldo_ahorro": 120000.0,
        "deuda_total": 15000.0,
        "pagos_atrasados": 0,
        "puntos_fidelidad": 4350,
        "nivel_fidelidad": "Oro",
        "score_crediticio": 782,
        "historial_crediticio": "Bueno",
        "tarjetas": [
            {
                "id_tarjeta": "TC-P001",
                "tipo": "Credito",
                "marca": "Visa Platinum",
                "numero_enmascarado": "4111 •••• •••• 8137",
                "vencimiento": "08/29",
                "estatus": "Activa",
                "limite_credito": 50000.0,
                "saldo_utilizado": 8000.0,
            },
            {
                "id_tarjeta": "TC-P002",
                "tipo": "Credito",
                "marca": "Mastercard Black",
                "numero_enmascarado": "5521 •••• •••• 5562",
                "vencimiento": "11/28",
                "estatus": "Activa",
                "limite_credito": 30000.0,
                "saldo_utilizado": 6500.0,
            },
            {
                "id_tarjeta": "TC-P003",
                "tipo": "Debito",
                "marca": "Visa",
                "numero_enmascarado": "4557 •••• •••• 9904",
                "vencimiento": "03/30",
                "estatus": "Activa",
                "limite_credito": None,
                "saldo_utilizado": None,
            },
            {
                "id_tarjeta": "TC-P004",
                "tipo": "Credito",
                "marca": "Visa Clásica",
                "numero_enmascarado": "4000 •••• •••• 4498",
                "vencimiento": "01/26",
                "estatus": "Vencida",
                "limite_credito": 10000.0,
                "saldo_utilizado": 3200.0,
            },
        ],
    },
    {
        "usuario": "Hector Barrera",
        "fecha_afiliacion": "2024-09-02",
        "ingreso_mensual": 28000.0,
        "saldo_ahorro": 35000.0,
        "deuda_total": 42000.0,
        "pagos_atrasados": 1,
        "puntos_fidelidad": 0,
        "nivel_fidelidad": "Basico",
        "score_crediticio": 695,
        "historial_crediticio": "Bueno",
        "tarjetas": [
            {
                "id_tarjeta": "TC-HB001",
                "tipo": "Credito",
                "marca": "Visa Clásica",
                "numero_enmascarado": "4111 •••• •••• 4210",
                "vencimiento": "05/27",
                "estatus": "Activa",
                "limite_credito": 15000.0,
                "saldo_utilizado": 9800.0,
            },
            {
                "id_tarjeta": "TC-HB002",
                "tipo": "Debito",
                "marca": "Mastercard",
                "numero_enmascarado": "5354 •••• •••• 7712",
                "vencimiento": "09/29",
                "estatus": "Activa",
                "limite_credito": None,
                "saldo_utilizado": None,
            },
        ],
    },
    {
        "usuario": "Hector Castro",
        "fecha_afiliacion": "2022-01-20",
        "ingreso_mensual": 21000.0,
        "saldo_ahorro": 8000.0,
        "deuda_total": 98000.0,
        "pagos_atrasados": 6,
        "puntos_fidelidad": 180,
        "nivel_fidelidad": "Basico",
        "score_crediticio": 588,
        "historial_crediticio": "Regular",
        "tarjetas": [
            {
                "id_tarjeta": "TC-HC001",
                "tipo": "Credito",
                "marca": "Visa Clásica",
                "numero_enmascarado": "4111 •••• •••• 3309",
                "vencimiento": "02/24",
                "estatus": "Vencida",
                "limite_credito": 8000.0,
                "saldo_utilizado": 7600.0,
            },
            {
                "id_tarjeta": "TC-HC002",
                "tipo": "Credito",
                "marca": "Mastercard",
                "numero_enmascarado": "5214 •••• •••• 8844",
                "vencimiento": "07/25",
                "estatus": "Cancelada",
                "limite_credito": 12000.0,
                "saldo_utilizado": 0.0,
            },
            {
                "id_tarjeta": "TC-HC003",
                "tipo": "Debito",
                "marca": "Visa",
                "numero_enmascarado": "4557 •••• •••• 2210",
                "vencimiento": "10/24",
                "estatus": "Cancelada",
                "limite_credito": None,
                "saldo_utilizado": None,
            },
        ],
    },
    {
        "usuario": "Javier Ortiz",
        "fecha_afiliacion": "2026-03-11",
        "ingreso_mensual": 15000.0,
        "saldo_ahorro": 2500.0,
        "deuda_total": 0.0,
        "pagos_atrasados": 0,
        "puntos_fidelidad": 0,
        "nivel_fidelidad": None,
        "score_crediticio": None,
        "historial_crediticio": "Sin historial",
        "tarjetas": [],
    },
]


def _siguiente_id(df: pd.DataFrame) -> int:
    if df.empty:
        return 1
    return int(df["id_transaccion"].max()) + 1


def _leer_existente() -> pd.DataFrame:
    if RUTA_CSV.exists() and RUTA_CSV.stat().st_size > 0:
        try:
            return pd.read_csv(RUTA_CSV, dtype={"monto": float})
        except pd.errors.EmptyDataError:
            return pd.DataFrame(columns=COLUMNAS)
    return pd.DataFrame(columns=COLUMNAS)


def generar_historial(filas_por_usuario: int = 60, path: str | None = None) -> pd.DataFrame:
    ruta = RUTA_CSV if path is None else path
    hoy = dt.date.today()
    filas = []
    idx = 0
    for usuario in USUARIOS:
        for _ in range(filas_por_usuario):
            idx += 1
            categoria = random.choices(
                CATEGORIAS, weights=[30, 18, 12, 12, 14, 5, 2, 7], k=1
            )[0]
            monto_min, monto_max = PERFILES_MONTO[categoria]
            monto = round(random.uniform(monto_min, monto_max), 2)
            fecha = hoy - dt.timedelta(days=random.randint(0, 120), hours=random.randint(0, 23))
            filas.append(
                {
                    "id_transaccion": idx,
                    "usuario": usuario,
                    "fecha": fecha.strftime("%Y-%m-%d %H:%M:%S"),
                    "categoria": categoria,
                    "monto": monto,
                    "descripcion": fake.sentence(nb_words=5),
                }
            )

    df = pd.DataFrame(filas, columns=COLUMNAS)
    df.to_csv(ruta, index=False, encoding="utf-8")
    return df


def agregar_transaccion(
    usuario: str,
    monto: float,
    categoria: str,
    descripcion: str,
    fecha: str | None = None,
) -> pd.Series:
    df = _leer_existente()
    if df.empty and not RUTA_CSV.exists():
        df = generar_historial(filas_por_usuario=60)
        df = _leer_existente()

    fecha = fecha or dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    nueva = pd.Series(
        {
            "id_transaccion": _siguiente_id(df),
            "usuario": usuario,
            "fecha": fecha,
            "categoria": categoria,
            "monto": float(monto),
            "descripcion": descripcion,
        }
    )

    fila = pd.DataFrame([nueva])
    fila.to_csv(RUTA_CSV, mode="a", header=False, index=False, encoding="utf-8")
    return nueva


def generar_usuarios_bancario(path: str | None = None) -> pd.DataFrame:
    ruta = RUTA_USUARIOS_BANCARIO if path is None else path
    filas = []
    for perfil in PERFILES_BANCARIOS:
        filas.append(
            {
                col: perfil.get(col, "")
                for col in COLUMNAS_USUARIO
            }
        )
    df = pd.DataFrame(filas, columns=COLUMNAS_USUARIO)
    df.to_csv(ruta, index=False, encoding="utf-8")
    return df


def generar_tarjetas(path: str | None = None) -> pd.DataFrame:
    ruta = RUTA_TARJETAS if path is None else path
    filas = []
    for perfil in PERFILES_BANCARIOS:
        for tarjeta in perfil.get("tarjetas", []):
            filas.append({"usuario": perfil["usuario"], **tarjeta})
    df = pd.DataFrame(filas, columns=COLUMNAS_TARJETA)
    df.to_csv(ruta, index=False, encoding="utf-8")
    return df


def generar_bd_completa(filas_por_usuario: int = 60) -> dict[str, pd.DataFrame]:
    return {
        "transacciones": generar_historial(filas_por_usuario=filas_por_usuario),
        "usuarios_bancario": generar_usuarios_bancario(),
        "tarjetas": generar_tarjetas(),
    }


if __name__ == "__main__":
    tablas = generar_bd_completa()
    print("Base de datos local regenerada:")
    print(f"  • transacciones.csv      -> {len(tablas['transacciones'])} filas")
    print(f"  • usuarios_bancario.csv  -> {len(tablas['usuarios_bancario'])} filas")
    print(f"  • tarjetas.csv           -> {len(tablas['tarjetas'])} filas")
    print("\nPerfiles bancarios por usuario:")
    print(tablas["usuarios_bancario"][
        ["usuario", "puntos_fidelidad", "nivel_fidelidad", "score_crediticio", "historial_crediticio"]
    ].to_string(index=False))
    print("\nTarjetas:")
    print(tablas["tarjetas"][
        ["id_tarjeta", "usuario", "tipo", "marca", "estatus"]
    ].to_string(index=False))