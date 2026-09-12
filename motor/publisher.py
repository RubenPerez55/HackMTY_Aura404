"""Publicador HTTP de triggers al backend (POST /api/triggers/impact).

Reintentos con backoff exponencial. Trata 200/201/202 y duplicados como exito.
Nunca relanza excepciones de red; devuelve True/False.
"""
from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from config import (
    MOTOR_BACKEND_URL,
    MOTOR_PUBLISH_BACKOFF,
    MOTOR_PUBLISH_ENABLED,
    MOTOR_PUBLISH_MAX_RETRIES,
    MOTOR_PUBLISH_REQUIRED,
    MOTOR_PUBLISH_TIMEOUT,
)

logger = logging.getLogger("motor.publisher")


def publicar_trigger(impacto: Dict[str, Any]) -> bool:
    """Publica un trigger fact al backend. Devuelve True si se acepto."""
    if not MOTOR_PUBLISH_ENABLED:
        logger.debug("publicacion deshabilitada; skip %s", impacto.get("eventId"))
        return False

    url = f"{MOTOR_BACKEND_URL.rstrip('/')}/api/triggers/impact"
    payload_data = {
        "userId": impacto.get("userId"),
        "event": impacto,
    }
    payload = json.dumps(payload_data, ensure_ascii=False, default=str).encode("utf-8")

    for intento in range(MOTOR_PUBLISH_MAX_RETRIES):
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "AuraMotor/1.0",
                    "X-Event-Id": impacto.get("eventId", ""),
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=MOTOR_PUBLISH_TIMEOUT) as resp:
                codigo = resp.status
                body = resp.read().decode("utf-8", errors="replace")
                if codigo in (200, 201, 202):
                    logger.info(
                        "trigger %s publicado (HTTP %d)", impacto.get("eventId"), codigo
                    )
                    return True
                logger.warning(
                    "trigger %s respuesta inesperada HTTP %d: %s",
                    impacto.get("eventId"), codigo, body[:200],
                )
                # Reintentar solo en errores de servidor.
                if 500 <= codigo < 600:
                    time.sleep(MOTOR_PUBLISH_BACKOFF * (2 ** intento))
                    continue
                return False

        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            codigo = exc.code
            # 409 Conflict o 422 = duplicado / ya existe; no es error.
            if codigo in (409, 422):
                logger.info("trigger %s duplicado (HTTP %d); skip", impacto.get("eventId"), codigo)
                return True
            if 500 <= codigo < 600:
                logger.warning(
                    "trigger %s error servidor HTTP %d (intento %d): %s",
                    impacto.get("eventId"), codigo, intento + 1, body[:200],
                )
                time.sleep(MOTOR_PUBLISH_BACKOFF * (2 ** intento))
                continue
            logger.error(
                "trigger %s error cliente HTTP %d: %s", impacto.get("eventId"), codigo, body[:200]
            )
            return False

        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            logger.warning(
                "trigger %s error red (intento %d): %s",
                impacto.get("eventId"), intento + 1, exc,
            )
            if intento < MOTOR_PUBLISH_MAX_RETRIES - 1:
                time.sleep(MOTOR_PUBLISH_BACKOFF * (2 ** intento))
            continue

    if MOTOR_PUBLISH_REQUIRED:
        logger.error("trigger %s FALLO tras %d reintentos (requerido)", impacto.get("eventId"), MOTOR_PUBLISH_MAX_RETRIES)
        return False

    logger.warning(
        "trigger %s fallo publicacion (no requerido); continuan=%s",
        impacto.get("eventId"), MOTOR_PUBLISH_REQUIRED,
    )
    return False
