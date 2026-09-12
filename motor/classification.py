"""Normalización de comercios y categorización determinista.

Busca el patrón del catálogo en la descripción normalizada o en el campo
`contraparte_nombre`; devueve merchant sugerido, categoría y concepto.

Se mantiene compatible con la columna legacy `categoria`: si la transacción
ya tiene una categoría sensible del catálogo se prioriza el dato real.
"""
from __future__ import annotations

from typing import Optional

from config import (
    MERCHANT_CATALOG,
    RECURRENCE_MIN_PREVIOUS,
    SERVICE_CATEGORIES,
    UMBRAL_COBRO_INDIVIDUAL,
)
from models import Transaction, normalizar_texto


def classify_deterministic(transaction: Transaction) -> dict:
    """
    Clasificación determinista sin LLM.

    Devuelve dict con:
      merchant (str), category (str), concept (str),
      inferido_patrocinador (bool), patron_detectado (str | None),
      categoria_original (str).
    """
    texto = transaction.descripcion_norm
    contraparte = normalizar_texto(transaction.contraparte_nombre)

    merchant_detected = ""
    category_detected = ""
    concept_detected = ""
    patron_detectado: Optional[str] = None

    for entrada in MERCHANT_CATALOG:
        patron = entrada.get("patron", entrada.get("patterns", []))
        if isinstance(patron, str):
            patron = [patron]
        patron_upper = [normalizar_texto(p) for p in patron]

        matches = any(p in texto for p in patron_upper) or any(
            p in contraparte for p in patron_upper
        )
        if matches:
            merchant_detected = entrada.get("merchant", "")
            category_detected = entrada.get("category", "")
            concept_detected = entrada.get("concept", "")
            patron_detectado = patron_upper[0]
            break

    inferido = bool(merchant_detected)
    categoria_original = transaction.categoria_original or transaction.categoria

    # Si hay categoría original del catálogo superior, respetarla.
    if categoria_original.lower() in {c.lower() for c in SERVICE_CATEGORIES}:
        category_detected = "service"
    elif categoria_original.lower() == "comida":
        category_detected = "dining"
    elif categoria_original.lower() in {"entretenimiento", "subscriptions"}:
        category_detected = "subscriptions"
    elif categoria_original.lower() in {"compras", "comercio"}:
        category_detected = "commerce"
    elif categoria_original.lower() in {"servicios", "utilities"}:
        category_detected = "service"
    elif categoria_original.lower() == "transporte":
        category_detected = "transport"

    return {
        "merchant": merchant_detected,
        "category": category_detected,
        "concept": concept_detected,
        "inferido_patrocinador": inferido,
        "patron_detectado": patron_detectado,
        "categoria_original": categoria_original,
    }


def clasificar_servicio(transaction: Transaction) -> bool:
    """Devuelve True si la transacción parece ser un servicio recurrente."""
    clasificacion = classify_deterministic(transaction)
    return clasificacion["category"] in SERVICE_CATEGORIES
