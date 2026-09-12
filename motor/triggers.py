"""Detector de transacciones de impacto (ShockAbsorber).

Tres reglas deterministas:
  1. service_spike      - pico de servicio recurrente ya cobrado
  2. annual_fee_charged - anualidad ya cobrada
  3. liquidity_shock    - shock de liquidez tras el cargo

Cada regla exige direccion=debit y estatus=posted. No hay LLM.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from config import (
    ANNUAL_FEE_PATTERNS,
    DAILY_NEED_FRACTION,
    DEFAULT_DAILY_NEED,
    LIQUIDITY_CRITICAL_RATE,
    LIQUIDITY_CONSUMPTION_RATE,
    SEVERITY_REASONS,
    SERVICE_CATEGORIES,
    SERVICE_SPIKE_MIN_HISTORY,
    SERVICE_SPIKE_MIN_PERCENT,
    SERVICE_SPIKE_MIN_SCORE,
)
from classification import classify_deterministic
from models import (
    Transaction,
    dias_hasta,
    normalizar_texto,
    proxima_nomina,
)
from recurrence import (
    agrupar_por_contraparte,
    analizar_recurrencia,
    comparar_monto,
)


def _float(valor: Any) -> Optional[float]:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


_PRIORIDAD_SEVERIDAD = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _max_severidad(severidades: List[str]) -> str:
    return min(severidades, key=lambda s: _PRIORIDAD_SEVERIDAD.get(s, 9))


def _unir_razones(grupos: List[List[str]], tope: int = 8) -> List[str]:
    unicas: List[str] = []
    for grupo in grupos:
        for razon in grupo:
            if razon not in unicas:
                unicas.append(razon)
    return unicas[:tope]


# ---------- datos de liquidez -----------------------------------------------
def _calcular_datos_liquidez(
    tx: Transaction,
    contexto: Dict[str, Any],
) -> Dict[str, Any]:
    saldo_disponible = _float(contexto.get("saldo_disponible")) or 0.0

    if tx.saldo_despues is not None:
        saldo_post = tx.saldo_despues
        saldo_pre = saldo_post + tx.monto
    else:
        saldo_pre = saldo_disponible
        saldo_post = saldo_pre - tx.monto

    consumo_pct = (tx.monto / saldo_pre) if saldo_pre > 0 else 1.0
    ingreso = _float(contexto.get("ingreso_mensual"))
    necesidad_diaria = (
        (ingreso / 30.0 * DAILY_NEED_FRACTION) if ingreso and ingreso > 0
        else DEFAULT_DAILY_NEED
    )
    prox_nomina = proxima_nomina(contexto, tx.fecha)
    dias_nomina = dias_hasta(prox_nomina, tx.fecha)

    faltante: Optional[float] = None
    if dias_nomina is not None and dias_nomina > 0:
        faltante = round(saldo_post - necesidad_diaria * dias_nomina, 2)

    return {
        "saldo_pre": round(saldo_pre, 2),
        "saldo_post": round(saldo_post, 2),
        "consumo_pct": round(consumo_pct, 4),
        "ingreso_mensual": round(ingreso or 0, 2),
        "necesidad_diaria": round(necesidad_diaria, 2),
        "dias_hasta_nomina": round(dias_nomina, 1) if dias_nomina is not None else None,
        "faltante_proyectado": faltante,
        "fecha_nomina": prox_nomina.replace(microsecond=0).isoformat(),
        "saldo_disponible_actual": round(saldo_disponible, 2),
    }


# ---------- severidad -------------------------------------------------------
def _severidad_para_regla(tipo: str, datos: Dict[str, Any]) -> tuple[str, List[str]]:
    if tipo == "service_spike":
        if datos.get("saldo_post") is not None and datos["saldo_post"] < 0:
            return "critical", [SEVERITY_REASONS["critical_negative_balance"]]
        if datos.get("consumo_pct", 0) >= LIQUIDITY_CRITICAL_RATE:
            return "critical", [SEVERITY_REASONS["critical_consumption"]]
        if datos.get("faltante_proyectado") is not None and datos["faltante_proyectado"] < 0:
            return "high", [SEVERITY_REASONS["high_insufficient_until_payroll"]]
        if datos.get("consumo_pct", 0) >= LIQUIDITY_CONSUMPTION_RATE:
            return "high", [SEVERITY_REASONS["high_consumption"]]
        return "medium", [SEVERITY_REASONS["medium_service_spike"]]

    if tipo == "annual_fee_charged":
        if datos.get("saldo_post") is not None and datos["saldo_post"] < 0:
            return "critical", [SEVERITY_REASONS["critical_negative_balance"]]
        if datos.get("consumo_pct", 0) >= LIQUIDITY_CRITICAL_RATE:
            return "critical", [SEVERITY_REASONS["critical_consumption"]]
        if datos.get("consumo_pct", 0) >= LIQUIDITY_CONSUMPTION_RATE:
            return "high", [SEVERITY_REASONS["high_consumption"]]
        return "medium", [SEVERITY_REASONS["medium_annual_fee"]]

    if tipo == "liquidity_shock":
        if datos.get("saldo_post") is not None and datos["saldo_post"] < 0:
            return "critical", [SEVERITY_REASONS["critical_negative_balance"]]
        if datos.get("faltante_proyectado") is not None and datos["faltante_proyectado"] < 0:
            return "critical", [SEVERITY_REASONS["critical_projected_shortfall"]]
        if datos.get("consumo_pct", 0) >= LIQUIDITY_CRITICAL_RATE:
            return "critical", [SEVERITY_REASONS["critical_consumption"]]
        return "high", [SEVERITY_REASONS["high_consumption"]]

    return "low", [SEVERITY_REASONS["low_aux"]]


# ---------- acciones sugeridas ----------------------------------------------
def _acciones_para(tipo: str) -> List[Dict[str, str]]:
    if tipo == "annual_fee_charged":
        return [
            {"id": "redeem_points", "label": "Redimir puntos para cubrir la anualidad",
             "feature": "points_redemption", "mcpTool": "simulate_points_redemption"},
            {"id": "waive_fee", "label": "Solicitar exencion de anualidad",
             "feature": "domiciliation_waiver", "mcpTool": "simulate_domiciliation_waiver"},
        ]
    if tipo == "service_spike":
        return [
            {"id": "analyze_variation", "label": "Analizar aumento del servicio",
             "feature": "service_spike_analysis", "mcpTool": ""},
            {"id": "setup_monthly_limit", "label": "Configurar alerta mensual de consumo",
             "feature": "monthly_limit_alert", "mcpTool": ""},
        ]
    if tipo == "liquidity_shock":
        return [
            {"id": "relocate_funds", "label": "Transferir fondos de ahorro",
             "feature": "relocate_funds", "mcpTool": ""},
            {"id": "emergency_credit", "label": "Solicitar linea de emergencia",
             "feature": "credit_line", "mcpTool": "simulate_installments"},
        ]
    return []


# ---------- ui_hint ---------------------------------------------------------
def _ui_hint(
    tipo: str,
    datos: Dict[str, Any],
    severidad: str,
) -> Dict[str, Any]:
    badges = {
        "service_spike": "Pico de servicio",
        "annual_fee_charged": "Anualidad cobrada",
        "liquidity_shock": "Shock de liquidez",
    }
    title = {
        "service_spike": "Aumento detectado en servicio recurrente",
        "annual_fee_charged": "Anualidad ya cobrada",
        "liquidity_shock": "Saldo comprometido tras cargo",
    }
    messages = {
        "service_spike": (
            f"Se detecto un aumento del {datos.get('variacion_porcentaje', 0):.0f}% "
            f"respecto a tu pago historico."
        ),
        "annual_fee_charged": (
            f"Se cobro ${datos.get('monto', 0):,.0f} MXN de anualidad en tu tarjeta."
        ),
        "liquidity_shock": (
            f"Tu saldo se redujo a ${datos.get('saldo_post', 0):,.0f} MXN "
            f"({datos.get('consumo_pct', 0)*100:.0f}% del disponible)."
        ),
    }
    return {
        "type": f"{tipo}_card",
        "title": title.get(tipo, tipo),
        "message": messages.get(tipo, ""),
        "badge": badges.get(tipo, tipo),
        "severity": severidad,
        "metric": _metrica(tipo, datos),
    }


def _metrica(tipo: str, datos: Dict[str, Any]) -> Dict[str, Any]:
    if tipo == "service_spike":
        return {
            "label": "Incremento vs referencia",
            "value": f"+{datos.get('variacion_porcentaje', 0):.0f}%",
            "detail": f"historico: ${datos.get('monto_referencia', 0):,.0f} MXN",
        }
    if tipo == "annual_fee_charged":
        return {
            "label": "Monto cobrado",
            "value": f"${datos.get('monto', 0):,.0f} MXN",
            "detail": f"post-saldo: ${datos.get('saldo_post', 0):,.0f}",
        }
    if tipo == "liquidity_shock":
        return {
            "label": "Saldo restante",
            "value": f"${datos.get('saldo_post', 0):,.0f} MXN",
            "detail": f"{datos.get('consumo_pct', 0)*100:.0f}% consumido",
        }
    return {}


# ===========================================================================
# Senal 1: pico de servicio recurrente
# ===========================================================================
def _detectar_pico_servicio(
    tx: Transaction,
    historial: List[Transaction],
    clave_grupo: str,
) -> Optional[Dict[str, Any]]:
    clasificacion = classify_deterministic(tx)
    if clasificacion["category"] not in SERVICE_CATEGORIES:
        return None

    grupo = agrupar_por_contraparte(historial).get(clave_grupo, [])
    recurrencia = analizar_recurrencia(grupo)
    comparacion = comparar_monto(tx, recurrencia, grupo)

    if (
        recurrencia["muestras_previas"] >= SERVICE_SPIKE_MIN_HISTORY
        and recurrencia["score"] >= SERVICE_SPIKE_MIN_SCORE
        and comparacion is not None
        and comparacion["variacion_porcentaje"] >= SERVICE_SPIKE_MIN_PERCENT
    ):
        evidencia = list(recurrencia["evidencia"]) + list(comparacion["evidencia"])
        evidencia.append(
            f"servicio {clasificacion['merchant'] or tx.descripcion_norm} "
            f"({clasificacion['concept']})"
        )
        return {
            "tipo": "service_spike",
            "score": round(min(1.0, 0.5 + recurrencia["score"] * 0.5), 2),
            "recurrencia": recurrencia,
            "merchant": clasificacion["merchant"],
            "categoria": clasificacion["category"],
            "concept": clasificacion["concept"],
            "montoReferencia": recurrencia["monto_referencia"],
            "variacionPorcentaje": comparacion["variacion_porcentaje"],
            "razones": [],
            "evidencia": evidencia,
        }
    return None


# ===========================================================================
# Senal 2: anualidad ya cobrada
# ===========================================================================
def _detectar_anualidad(tx: Transaction) -> Optional[Dict[str, Any]]:
    texto = tx.descripcion_norm
    contraparte = normalizar_texto(tx.contraparte_nombre or "")
    if not any(normalizar_texto(p) in texto for p in ANNUAL_FEE_PATTERNS):
        if "ANUALIDAD" not in contraparte and "MEMBRESIA" not in contraparte:
            return None
    return {
        "tipo": "annual_fee_charged",
        "score": 1.0,
        "razones": [],
        "evidencia": [
            f"concepto de anualidad detectado en: {tx.descripcion or tx.contraparte_nombre}"
        ],
    }


# ===========================================================================
# Senal 3: shock de liquidez
# ===========================================================================
def _detectar_liquidez(
    tx: Transaction,
    datos_liquidez: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    consumo_pct = datos_liquidez["consumo_pct"]
    saldo_post = datos_liquidez["saldo_post"]

    if saldo_post < 0 or consumo_pct >= LIQUIDITY_CONSUMPTION_RATE:
        evidencia = []
        if saldo_post < 0:
            evidencia.append(f"saldo posterior al cargo: ${saldo_post:,.0f} MXN (negativo)")
        else:
            evidencia.append(
                f"el cargo consume el {consumo_pct*100:.0f}% del saldo previo "
                f"(${datos_liquidez['saldo_pre']:,.0f} MXN)"
            )
        return {
            "tipo": "liquidity_shock",
            "score": round(min(1.0, consumo_pct), 2),
            "saldoPre": datos_liquidez["saldo_pre"],
            "saldoPost": saldo_post,
            "consumoPorcentaje": round(consumo_pct * 100, 1),
            "diasHastaNomina": datos_liquidez["dias_hasta_nomina"],
            "faltanteProyectado": datos_liquidez["faltante_proyectado"],
            "razones": [],
            "evidencia": evidencia,
        }
    return None


# ===========================================================================
# Evaluacion de una sola transaccion
# ===========================================================================
def _clave_comparacion(tx: Transaction) -> str:
    contraparte = normalizar_texto(tx.contraparte_nombre or "")
    return contraparte if contraparte else tx.descripcion_norm or normalizar_texto(tx.categoria)


def evaluar_transaccion(
    tx: Transaction,
    historial: List[Transaction],
    contexto: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Evalua UNA transaccion y devuelve un trigger fact, o None si no dispara nada."""
    if not tx.es_debito or not tx.esta_posted:
        return None

    senales: List[Dict[str, Any]] = []
    clave_grupo = _clave_comparacion(tx)
    datos_liq = _calcular_datos_liquidez(tx, contexto)

    pico = _detectar_pico_servicio(tx, historial, clave_grupo)
    if pico:
        senales.append(pico)

    anualidad = _detectar_anualidad(tx)
    if anualidad:
        senales.append(anualidad)

    liquidez = _detectar_liquidez(tx, datos_liq)
    if liquidez:
        senales.append(liquidez)

    if not senales:
        return None

    # Combinar todas las senales en un solo trigger fact.
    tipos = [s["tipo"] for s in senales]
    todas_razones = _unir_razones([s.get("razones", []) for s in senales])
    todas_evidencias: List[str] = []
    for s in senales:
        todas_evidencias.extend(s.get("evidencia", []))

    datos_severidad = {
        **datos_liq,
        "monto": tx.monto,
        "montoReferencia": next(
            (s.get("montoReferencia", 0) for s in senales if s["tipo"] == "service_spike"),
            0,
        ),
        "variacionPorcentaje": next(
            (s.get("variacionPorcentaje", 0) for s in senales if s["tipo"] == "service_spike"),
            0,
        ),
    }

    # Calcular severidad por cada tipo y quedarse con la maxima.
    severidades: List[str] = []
    razones_por_tipo: List[List[str]] = []
    for s in senales:
        sev, raz = _severidad_para_regla(s["tipo"], datos_severidad)
        s["razones_severidad"] = raz
        severidades.append(sev)
        razones_por_tipo.append(raz)

    severidad_final = _max_severidad(severidades)
    razones_finales = _unir_razones(razones_por_tipo)
    if todas_razones:
        razones_finales = _unir_razones([todas_razones, razones_finales])

    # Recopilar IDs de transacciones de evidencia (historicas relevantes).
    evidencia_ids: List[str] = []
    for s in senales:
        if s["tipo"] == "service_spike" and s.get("recurrencia"):
            pass  # recurrencia contains evidence, not transaction IDs directly

    recurrencia_info = next(
        (s.get("recurrencia") for s in senales if s["tipo"] == "service_spike"),
        None,
    )

    tipos_disparados = list(dict.fromkeys(tipos))  # unique, ordered
    ui_hints = [_ui_hint(t, datos_severidad, severidad_final) for t in tipos_disparados]
    acciones: List[Dict[str, str]] = []
    for t in tipos_disparados:
        for accion in _acciones_para(t):
            if accion["id"] not in {a["id"] for a in acciones}:
                acciones.append(accion)

    return {
        "eventId": f"evt-{tx.id_transaccion}",
        "groupId": f"impact-{tx.usuario}-{tx.fecha_dia}",
        "userId": tx.usuario,
        "accountId": tx.cuenta_origen or tx.usuario,
        "cardId": tx.id_tarjeta,
        "fecha": tx.fecha.replace(microsecond=0).isoformat(),
        "transaccionId": tx.id_transaccion,
        "monto": tx.monto,
        "moneda": tx.moneda,
        "merchant": next(
            (s.get("merchant") for s in senales if s.get("merchant")),
            tx.contraparte_nombre or "",
        ),
        "categoria": tx.categoria_original or tx.categoria,
        "descripcion": tx.descripcion,
        "disparado": tipos_disparados,
        "severidad": severidad_final,
        "razonesSeveridad": razones_finales,
        "evidencia": list(dict.fromkeys(todas_evidencias)),
        "recurrencia": recurrencia_info,
        "montos": {
            "monto": tx.monto,
            "moneda": tx.moneda,
            "saldoPre": datos_liq["saldo_pre"],
            "saldoPost": datos_liq["saldo_post"],
            "consumoPorcentaje": round(datos_liq["consumo_pct"] * 100, 1),
            "ingresoMensual": datos_liq["ingreso_mensual"],
            "necesidadDiaria": datos_liq["necesidad_diaria"],
            "diasHastaNomina": datos_liq["dias_hasta_nomina"],
            "faltanteProyectado": datos_liq["faltante_proyectado"],
            "fechaNomina": datos_liq["fecha_nomina"],
            "saldoDisponible": datos_liq["saldo_disponible_actual"],
        },
        "transaccionesIds": [tx.id_transaccion] + evidencia_ids,
        "uiHint": ui_hints,
        "accionesDisponibles": acciones,
    }


# ===========================================================================
# Combinacion de impactos (mismo dia / misma persona / misma cuenta)
# ===========================================================================
def case_id(tx: Transaction) -> str:
    return f"impact-{tx.usuario}-{tx.fecha_dia}"


def agregar_impactos(impactos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Agrupa impactos por groupId y genera disparos combinados."""
    grupos: Dict[str, List[Dict[str, Any]]] = {}
    for imp in impactos:
        gid = imp["groupId"]
        grupos.setdefault(gid, []).append(imp)

    combinados: List[Dict[str, Any]] = []
    for gid, miembros in grupos.items():
        if len(miembros) == 1:
            combinados.append(miembros[0])
            continue

        tipos = []
        for m in miembros:
            tipos.extend(m["disparado"])
        tipos_unicos = list(dict.fromkeys(tipos))

        severidades = [m["severidad"] for m in miembros]
        severidad = _max_severidad(severidades)

        razones = _unir_razones([m["razonesSeveridad"] for m in miembros])
        evidencia: List[str] = []
        for m in miembros:
            evidencia.extend(m["evidencia"])
        evidencia = list(dict.fromkeys(evidencia))

        tx_ids: List[str] = []
        for m in miembros:
            tx_ids.extend(m["transaccionesIds"])
        tx_ids = list(dict.fromkeys(tx_ids))

        # Montos del miembro con mayor monto.
        mayor = max(miembros, key=lambda m: m["monto"])

        # Acciones de todos los tipos.
        acciones: List[Dict[str, str]] = []
        for t in tipos_unicos:
            for accion in _acciones_para(t):
                if accion["id"] not in {a["id"] for a in acciones}:
                    acciones.append(accion)

        ui_hints = [_ui_hint(t, mayor["montos"], severidad) for t in tipos_unicos]

        combinados.append({
            **mayor,
            "eventId": f"{mayor['eventId']}-combined",
            "groupId": gid,
            "disparado": tipos_unicos,
            "severidad": severidad,
            "razonesSeveridad": razones,
            "evidencia": evidencia,
            "transaccionesIds": tx_ids,
            "uiHint": ui_hints,
            "accionesDisponibles": acciones,
        })

    return combinados
