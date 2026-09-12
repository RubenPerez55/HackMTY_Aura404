RESET = "\033[0m"
BOLD = "\033[1m"
ROJO = "\033[91m"
AMARILLO = "\033[93m"
CIAN = "\033[96m"
VERDE = "\033[92m"
MAGENTA = "\033[95m"


def _linea(char: str = "─", n: int = 72) -> str:
    return char * n


def _fmt_moneda(valor: float | None) -> str:
    if valor is None:
        return "Sin dato"
    return f"${valor:,.2f} MXN"


def _imprimir_contexto_bancario(ctx: dict | None, usuario: str) -> None:
    print(f"\n  {BOLD}CONTEXTO BANCARIO DEL USUARIO{RESET}")

    if not ctx:
        print(f"{AMARILLO}    ⚠  Usuario {usuario} sin perfil bancario en la base.{RESET}")
        return

    nivel = ctx.get("nivel_fidelidad") or "Sin asignar"
    puntos = ctx.get("puntos_fidelidad")
    print(f"    • Ingreso mensual     : {_fmt_moneda(ctx.get('ingreso_mensual'))}")
    print(f"    • Saldo en ahorro     : {_fmt_moneda(ctx.get('saldo_ahorro'))}")
    print(f"    • Deuda total         : {_fmt_moneda(ctx.get('deuda_total'))}")
    print(
        f"    • Puntos fidelidad    : {puntos if puntos is not None else 'Sin asignar'} ({nivel})"
    )
    if ctx.get("score_crediticio") is not None:
        print(
            f"    • Score crediticio    : {int(ctx['score_crediticio'])} "
            f"({ctx.get('historial_crediticio') or 'n/a'})"
        )
    else:
        print(f"    • Score crediticio    : Sin historial ({ctx.get('historial_crediticio') or 'n/a'})")

    activas = ctx.get("tarjetas_activas", [])
    if activas:
        print(f"    • Tarjetas activas    : {ctx.get('credito_activas', 0)} crédito, {ctx.get('debito_activas', 0)} débito")
        for t in activas:
            print(f"        - {t['marca']} {t['tipo']} · {t['numero_enmascarado']} (venc. {t['vencimiento']})")
    else:
        print(f"{AMARILLO}    • Tarjetas activas    : Ninguna (0 crédito, 0 débito){RESET}")


def procesar_evento(evento: dict) -> None:
    print()
    print(f"{BOLD}{ROJO}{_linea('═')}{RESET}")
    print(f"{BOLD}{ROJO}  ⚠  TRIGGER FINANCIERO ESTRUCTURADO{RESET}")
    print(f"{BOLD}{ROJO}{_linea('═')}{RESET}")

    fecha = evento.get("fecha", "")
    usuario = evento.get("usuario", "")
    monto = evento.get("monto", 0)

    if evento["event"] == "LIQUIDITY_SHOCK_DETECTED":
        print(f"{AMARILLO}  EVENTO        : LIQUIDITY_SHOCK_DETECTED{RESET}")
        print(f"{CIAN}  USUARIO       : {BOLD}{usuario}{RESET}")
        if fecha:
            print(f"  FECHA         : {fecha}")
        print(f"  MONTO         : ${float(monto):,.2f} MXN")
        for d in evento.get("detalles", []):
            print(f"\n  {BOLD}[{d['tipo'].upper()}]{RESET}")
            print(f"    → {d['detalle']}")
    elif evento["event"] == "SPENDING_SPIKE_DETECTED":
        print(f"{AMARILLO}  EVENTO        : SPENDING_SPIKE_DETECTED{RESET}")
        print(f"{CIAN}  USUARIO       : {BOLD}{usuario}{RESET}")
        print(f"  CATEGORÍA     : {evento.get('categoria', '')}")
        print(f"  MONTO         : ${float(monto):,.2f} MXN")
        print(f"  MEDIA HISTÓRICA: ${evento.get('media_historica', 0):,.2f} MXN")
        print(f"  UMBRAL        : ${evento.get('umbral', 0):,.2f} MXN")
        print(f"  Z-SCORE       : {evento.get('z_score')}")
        print(f"  DIFERENCIA    : ${evento.get('margen', 0):,.2f} MXN")

    _imprimir_contexto_bancario(evento.get("contexto"), usuario)
    print(f"{VERDE}  ESTADO        : {BOLD}AGENTE NOTIFICADO (backend pendiente){RESET}")
    print(f"{ROJO}{_linea('═')}{RESET}")
    print()


def notificar_transaccion_procesada(txn: dict) -> None:
    print(
        f"{BOLD}{VERDE}✔{RESET} {BOLD}{txn['usuario']}{RESET}  ${float(txn['monto']):,.2f} MXN  [{txn['categoria']}]  sin anomalías."
    )