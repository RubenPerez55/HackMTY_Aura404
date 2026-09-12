import numpy as np
import pandas as pd

from config import (
    MULTIPLO_BASELINE_7_DIAS,
    MULTIPLO_PICO,
    STD_MINIMA_PICO,
    UMBRAL_COBRO_INDIVIDUAL,
    UMBRAL_VENTANA_7_DIAS,
    Z_SCORE_PICO,
)


def _historial_usuario(df: pd.DataFrame, usuario: str) -> pd.DataFrame:
    sub = df[df["usuario"].astype(str).str.strip() == usuario].copy()
    if not sub.empty:
        sub["fecha_dt"] = pd.to_datetime(sub["fecha"])
    return sub


def detectar_pico_gasto(nueva_txn: pd.Series, historial: pd.DataFrame) -> dict | None:
    if historial.empty:
        return None

    categoria = nueva_txn["categoria"]
    monto = float(nueva_txn["monto"])
    en_categoria = historial[historial["categoria"] == categoria]["monto"].astype(float)

    if len(en_categoria) < 5:
        return None

    media = en_categoria.mean()
    std = en_categoria.std(ddof=1)

    if std < STD_MINIMA_PICO:
        spike = monto > MULTIPLO_PICO * media
        z_score = float(np.nan)
        umbral = float(MULTIPLO_PICO * media)
    else:
        z_score = float((monto - media) / std)
        umbral = float(media + Z_SCORE_PICO * std)
        spike = z_score > Z_SCORE_PICO

    if spike:
        return {
            "event": "SPENDING_SPIKE_DETECTED",
            "usuario": nueva_txn["usuario"],
            "categoria": categoria,
            "monto": monto,
            "media_historica": round(media, 2),
            "umbral": round(umbral, 2),
            "z_score": round(z_score, 2) if not np.isnan(z_score) else f">{MULTIPLO_PICO}x media",
            "margen": round(monto - media, 2),
        }
    return None


def detectar_liquidity_shock(nueva_txn: pd.Series, historial: pd.DataFrame) -> dict | None:
    monto = float(nueva_txn["monto"])
    fecha = pd.to_datetime(nueva_txn["fecha"])
    usuario = nueva_txn["usuario"]
    eventos = []

    if monto >= UMBRAL_COBRO_INDIVIDUAL:
        eventos.append(
            {
                "tipo": "cobro_individual",
                "detalle": f"Cobro individual de ${monto:,.2f} supera umbral crítico de ${UMBRAL_COBRO_INDIVIDUAL:,.0f} MXN",
            }
        )

    if not historial.empty:
        if "fecha_dt" not in historial.columns:
            historial = historial.copy()
            historial["fecha_dt"] = pd.to_datetime(historial["fecha"])
        match = historial["fecha_dt"].dt.date == fecha.date()
        historial_sin_hoy = historial[~match]
        baseline_7d = historial_sin_hoy.sort_values("fecha_dt").tail(7)["monto"].astype(float)
        suma_7d = float(baseline_7d.sum()) + monto

        umbral_min = UMBRAL_VENTANA_7_DIAS
        base_media_7d = float(baseline_7d.mean()) if len(baseline_7d) else 0.0
        umbral_relativo = MULTIPLO_BASELINE_7_DIAS * base_media_7d * 7 if base_media_7d else 0.0
        umbral_efectivo = max(umbral_min, umbral_relativo)

        if suma_7d >= umbral_efectivo:
            eventos.append(
                {
                    "tipo": "ventana_7_dias",
                    "detalle": (
                        f"Acumulado ventana móvil de 7 días ${suma_7d:,.2f} supera umbral "
                        f"${umbral_efectivo:,.0f} MXN (media diaria previa ${base_media_7d:,.2f})"
                    ),
                }
            )

    if eventos:
        return {
            "event": "LIQUIDITY_SHOCK_DETECTED",
            "usuario": usuario,
            "monto": monto,
            "fecha": str(fecha),
            "detalles": eventos,
        }
    return None


def evaluar_transaccion(nueva_txn: pd.Series, historial: pd.DataFrame) -> list[dict]:
    alertas = []
    pico = detectar_pico_gasto(nueva_txn, historial)
    if pico:
        alertas.append(pico)

    shock = detectar_liquidity_shock(nueva_txn, historial)
    if shock:
        alertas.append(shock)

    return alertas