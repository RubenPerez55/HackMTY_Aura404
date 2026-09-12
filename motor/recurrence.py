"""Detección de recurrencia determinista y explicable.

Analiza un histórico de transacciones de la misma contraparte/categoría
para calcular frecuencia, score y evidencia sin LLM.

El historial proporcionado debe incluir SOLO transacciones pasadas (no la
transacción actual being evaluated).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from statistics import mean, stdev
from typing import Dict, List, Optional, Tuple

from config import (
    FREQUENCY_BANDS,
    RECURRENCE_AMOUNT_CV_TOLERANCE,
    RECURRENCE_MAX_INTERVAL_CV,
    RECURRENCE_MIN_PREVIOUS,
    RECURRENCE_STRONG_PREVIOUS,
    RECURRENCE_STRONG_SCORE,
)
from models import Transaction, normalizar_texto


def _clave_comparacion(t: Transaction) -> str:
    """Clave de agrupación: contraparte normalizada, o categoría si falta."""
    contraparte = normalizar_texto(t.contraparte_nombre or "")
    if contraparte:
        return contraparte
    return t.descripcion_norm or normalizar_texto(t.categoria)


def analizar_recurrencia(historial: List[Transaction]) -> dict:
    """
    Analiza recurrencia para un grupo de transacciones históricas de la
    misma contraparte/categoría.

    Devuelve:
      score (float 0..1), frecuencia (str), intervalo_mediano_dias (float|None),
      muestras_previas (int), monto_referencia (float),
      evidencia (list[str]), consistente (bool).
    """
    # Solo débitos posted.
    relevantes = [
        t for t in historial if t.es_debito and t.esta_posted
    ]
    relevantes.sort(key=lambda t: t.fecha)

    if len(relevantes) < RECURRENCE_MIN_PREVIOUS:
        return {
            "score": 0.0,
            "frecuencia": "none",
            "intervalo_mediano_dias": None,
            "muestras_previas": len(relevantes),
            "monto_referencia": _mediana([t.monto for t in relevantes]) if relevantes else 0.0,
            "evidencia": [],
            "consistente": False,
        }

    # Intervals entre transacciones sucesivas.
    intervalos: List[float] = []
    for i in range(1, len(relevantes)):
        delta = (relevantes[i].fecha - relevantes[i - 1].fecha).total_seconds() / 86400.0
        if delta > 0:
            intervalos.append(delta)

    monto_referencia = _mediana([t.monto for t in relevantes])
    montos = [t.monto for t in relevantes]
    monto_cv = (stdev(montos) / mean(montos)) if len(montos) >= 2 and mean(montos) > 0 else 0.0

    intervalo_mediano = _mediana(intervalos) if intervalos else None
    consistente = (
        intervalo_mediano is not None
        and len(intervalos) >= 2
        and _cv(intervalos) <= RECURRENCE_MAX_INTERVAL_CV
        and monto_cv <= RECURRENCE_AMOUNT_CV_TOLERANCE
    )

    score = 0.0
    evidencia: List[str] = []

    if len(relevantes) >= RECURRENCE_STRONG_PREVIOUS and consistente:
        score = 0.8
        evidencia.append(f"{len(relevantes)} ocurrencias con intervalo consistente")
    elif len(relevantes) >= RECURRENCE_MIN_PREVIOUS:
        score = 0.5 if consistente else 0.3
        if consistente:
            evidencia.append(f"intervalo consistente mediano de {intervalo_mediano:.0f} días")
        evidencia.append(f"{len(relevantes)} muestras previas")

    if intervalo_mediano is not None and intervalo_mediano > 0:
        evidencia.append(f"intervalo mediano {intervalo_mediano:.0f} días")

    if monto_referencia > 0:
        evidencia.append(f"monto de referencia ${monto_referencia:,.0f} MXN")

    # Mapeo a frecuencia legible.
    frecuencia = "irregular"
    if intervalo_mediano is not None:
        for umbral, nombre in FREQUENCY_BANDS:
            if intervalo_mediano <= umbral:
                frecuencia = nombre
                break

    return {
        "score": round(score, 2),
        "frecuencia": frecuencia,
        "intervalo_mediano_dias": round(intervalo_mediano, 1) if intervalo_mediano is not None else None,
        "muestras_previas": len(relevantes),
        "monto_referencia": round(monto_referencia, 2),
        "evidencia": evidencia,
        "consistente": consistente,
    }


def sugerir_ventana_historial(recurrencia: dict) -> timedelta:
    """Inferir ventana de historial necesaria a partir del intervalo detectado."""
    dias = recurrencia.get("intervalo_mediano_dias")
    if dias is not None and dias > 0:
        return timedelta(days=max(60, dias * 5))
    return timedelta(days=180)


def agrupar_por_contraparte(
    transacciones: List[Transaction],
) -> Dict[str, List[Transaction]]:
    """Agrupa por clave de comparación de recurrencia."""
    grupos: Dict[str, List[Transaction]] = defaultdict(list)
    for t in transacciones:
        clave = _clave_comparacion(t)
        grupos[clave].append(t)
    return dict(grupos)


def comparar_monto(
    actual: Transaction,
    recurrencia: dict,
    historial: List[Transaction],
) -> Optional[dict]:
    """
    Compara la transacción actual con el historial de su contraparte.

    Devuelve:
      variacion_porcentaje, referencia_absoluta, evidencia.
    """
    referencia = recurrencia.get("monto_referencia", 0.0)
    if referencia <= 0:
        return None

    variacion = ((actual.monto - referencia) / referencia) * 100.0
    evidencia = [f"actual ${actual.monto:,.0f} vs referencia ${referencia:,.0f}"]
    if variacion >= 40:
        evidencia.append(f"+{variacion:.0f}% sobre la referencia")

    return {
        "variacion_porcentaje": round(variacion, 1),
        "referencia_absoluta": round(referencia, 2),
        "evidencia": evidencia,
    }


def _mediana(valores: List[float]) -> float:
    if not valores:
        return 0.0
    ordenados = sorted(valores)
    n = len(ordenados)
    mitad = n // 2
    if n % 2 == 0:
        return (ordenados[mitad - 1] + ordenados[mitad]) / 2.0
    return ordenados[mitad]


def _cv(valores: List[float]) -> float:
    if len(valores) < 2:
        return 0.0
    media = mean(valores)
    if media <= 0:
        return 0.0
    return stdev(valores) / media
