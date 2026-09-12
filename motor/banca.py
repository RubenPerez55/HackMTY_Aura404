import pandas as pd

from config import COLUMNAS_TARJETA, COLUMNAS_USUARIO, RUTA_TARJETAS, RUTA_USUARIOS_BANCARIO


def _si_existe(ruta, columnas) -> pd.DataFrame:
    if ruta.exists() and ruta.stat().st_size > 0:
        try:
            return pd.read_csv(ruta)
        except (pd.errors.EmptyDataError, pd.errors.ParserError):
            return pd.DataFrame(columns=columnas)
    return pd.DataFrame(columns=columnas)


def cargar_usuarios() -> pd.DataFrame:
    return _si_existe(RUTA_USUARIOS_BANCARIO, COLUMNAS_USUARIO)


def cargar_tarjetas() -> pd.DataFrame:
    return _si_existe(RUTA_TARJETAS, COLUMNAS_TARJETA)


def _valor(pd_valor, tipo=str):
    if pd.isna(pd_valor):
        return None
    return tipo(pd_valor)


def _numeros_a_floats(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def cargar_todo():
    usuarios = _numeros_a_floats(
        cargar_usuarios(),
        ["ingreso_mensual", "saldo_ahorro", "deuda_total", "score_crediticio", "puntos_fidelidad"],
    )
    tarjetas = _numeros_a_floats(
        cargar_tarjetas(), ["limite_credito", "saldo_utilizado"]
    )
    return usuarios, tarjetas


def contexto_usuario(
    usuario: str,
    usuarios: pd.DataFrame | None = None,
    tarjetas: pd.DataFrame | None = None,
) -> dict | None:
    if usuarios is None or tarjetas is None:
        usuarios_tmp, tarjetas_tmp = cargar_todo()
        usuarios = usuarios if usuarios is not None else usuarios_tmp
        tarjetas = tarjetas if tarjetas is not None else tarjetas_tmp

    if usuarios.empty or "usuario" not in usuarios.columns:
        return None

    perfil = usuarios[usuarios["usuario"].astype(str).str.strip() == usuario]
    if perfil.empty:
        return None
    perfil = perfil.iloc[0]

    filas_tarjetas = (
        tarjetas[tarjetas["usuario"].astype(str).str.strip() == usuario]
        if not tarjetas.empty
        else pd.DataFrame(columns=COLUMNAS_TARJETA)
    )
    tarjetas_lista = [
        {
            "id_tarjeta": row["id_tarjeta"],
            "tipo": row["tipo"],
            "marca": row["marca"],
            "numero_enmascarado": row["numero_enmascarado"],
            "vencimiento": row["vencimiento"],
            "estatus": row["estatus"],
            "limite_credito": _valor(row.get("limite_credito"), float),
            "saldo_utilizado": _valor(row.get("saldo_utilizado"), float),
        }
        for _, row in filas_tarjetas.iterrows()
    ] if not filas_tarjetas.empty else []

    return {
        "usuario": usuario,
        "fecha_afiliacion": _valor(perfil.get("fecha_afiliacion")),
        "ingreso_mensual": _valor(perfil.get("ingreso_mensual"), float),
        "saldo_ahorro": _valor(perfil.get("saldo_ahorro"), float),
        "deuda_total": _valor(perfil.get("deuda_total"), float),
        "pagos_atrasados": _valor(perfil.get("pagos_atrasados"), int),
        "puntos_fidelidad": _valor(perfil.get("puntos_fidelidad"), int),
        "nivel_fidelidad": _valor(perfil.get("nivel_fidelidad")),
        "score_crediticio": _valor(perfil.get("score_crediticio"), float),
        "historial_crediticio": _valor(perfil.get("historial_crediticio")),
        "tarjetas_activas": [t for t in tarjetas_lista if t["estatus"] == "Activa"],
        "tarjetas_totales": tarjetas_lista,
        "credito_activas": sum(1 for t in tarjetas_lista if t["estatus"] == "Activa" and t["tipo"] == "Credito"),
        "debito_activas": sum(1 for t in tarjetas_lista if t["estatus"] == "Activa" and t["tipo"] == "Debito"),
    }