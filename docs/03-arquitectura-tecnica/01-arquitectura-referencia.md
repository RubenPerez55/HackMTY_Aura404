# 1. Arquitectura de referencia (versión preliminar del equipo)

Este documento describe el diagrama de arquitectura que el equipo fue
elaborando en la última reunión (imagen compartida en el chat del
proyecto). Es **preliminar y sujeto a cambios**, pero ya es lo bastante
concreto como para empezar a construir sobre él. El contrato funcional
completo (comportamientos esperados, requisitos no funcionales, casos
límite) vive en `spec.md`, en la raíz del repo — este documento explica
las piezas técnicas que lo implementan.

## Diagrama (en texto)

```
Usuario ──HTTPS──▶ Front End (Web/Mobile)
                        │  renderiza componentes A2UI
                        │  envía intención, clics y confirmaciones
                        │
                        │ HTTPS · REST + SSE/WebSocket · A2UI JSON
                        ▼
                 Backend / Orquestador
        ┌───────────────────────────────────┐
        │ API Backend / BFF   │ Agent Harness│
        │ - expone endpoints  │ agent loop,   │
        │ - auth y seguridad  │ memoria de    │
        │ - enruta solicitudes│ sesión,       │
        │ - formatea A2UI     │ permisos,     │
        │                     │ validación    │
        ├───────────────────────────────────┤
        │ Agente financiero   │ MCP Client    │
        │ interpreta, decide, │ descubre e    │
        │ orquesta, genera A2UI│ invoca tools │
        └───────────────────────────────────┘
              │ HTTPS·REST·JSON       │ MCP · Streamable HTTP · JSON-RPC 2.0
              ▼                       ▼
      LLM vía API                MCP Server financiero
   (OpenRouter u otro          - get_balance
    proveedor · inferencia,    - get_transactions
    razonamiento, tool calling)- get_reward_points
                                - simulate_plan
                                - redeem_points
                                - enroll_autopay
                                       │ HTTPS · REST/JSON
                                       ▼
                          Datos y sistemas financieros
                    (BD transaccional, APIs bancarias/core,
                     puntos y beneficios, pagos y domiciliaciones)

Motor de detección de impacto financiero (aparte, corre en paralelo):
  Eventos de entrada: Service Spike (recibo muy superior al promedio),
                       Golpe de liquidez (cobro ≥ 75% del saldo actual)
  Procesamiento: normaliza eventos, consulta historial, calcula
                 métricas, aplica reglas
  → Consulta "Movimientos y recibos" de Datos y sistemas financieros
  → Emite "Trigger financiero estructurado" (ej. LIQUIDITY_SHOCK_DETECTED)
    al Backend/Orquestador (a su Agente financiero), como mensaje/evento,
    no como llamada de red convencional.
```

## Qué aporta cada pieza (y cómo se relaciona con lo que ya
   documentamos en `00-fundamentos-mcp/` y `01-agentic-ui-frontend/`)

- **Front End (Web/Mobile):** confirma lo que ya se había anticipado en
  `01-agentic-ui-frontend/02-comunicacion-frontend-mcp.md` — el frontend
  no habla MCP directamente, habla con el Backend/Orquestador vía HTTPS
  (REST + streaming SSE/WebSocket), recibiendo **A2UI JSON** como
  payload. Su trabajo es interpretarlo y montar los componentes
  reutilizables (ver `02-catalogo-componentes.md` en esta misma carpeta).

- **Backend / Orquestador:** es el **Host** en términos de MCP (ver
  `00-fundamentos-mcp/02-arquitectura-y-comunicacion.md`). Se divide en
  cuatro sub-piezas:
  - **API Backend / BFF** — expone los endpoints al frontend, maneja
    auth/seguridad, enruta solicitudes y formatea las respuestas como
    A2UI.
  - **Agent Harness** — el "loop" del agente: gestiona memoria de sesión,
    permisos y validación. Es la infraestructura alrededor del LLM (no el
    LLM en sí).
  - **Agente financiero** — la lógica que interpreta la intención,
    decide qué hacer, orquesta llamadas a MCP y genera la salida A2UI.
    Es el rol que en el reto de Banorte se describe como "el LLM al
    centro de la experiencia".
  - **MCP Client** — descubre e invoca las tools expuestas por el MCP
    Server (exactamente el rol de "Client" que se documentó en
    `00-fundamentos-mcp/`).

- **LLM vía API (OpenRouter u otro proveedor):** el motor de
  inferencia/razonamiento/tool-calling. Vive fuera del backend propio —
  se consume como servicio HTTPS/REST/JSON. Decisión de libertad de stack
  del reto (cualquier proveedor de modelo es válido).

- **MCP Server financiero:** el **Server** MCP, con sus **tools**
  concretas ya nombradas: `get_balance`, `get_transactions`,
  `get_reward_points`, `simulate_plan`, `redeem_points`,
  `enroll_autopay`. Esto es la primera lista real de tools del proyecto —
  vale la pena mantenerla sincronizada aquí conforme se agreguen o
  cambien.

- **Datos y sistemas financieros:** las fuentes de verdad que consulta el
  MCP Server (y el motor de detección): base de datos transaccional,
  APIs bancarias (core), puntos y beneficios, pagos y domiciliaciones.
  Todo esto se simula con datos sintéticos, como permite el reto.

- **Motor de detección de impacto financiero:** esta es la pieza nueva
  y más importante de la arquitectura — implementa la corrección que ya
  habíamos documentado en `02-banorte-contexto/03-decisiones-proyecto.md`
  (punto 4): la hiperpersonalización no es memoria conversacional, es
  **análisis de datos transaccionales**. Corre aparte del ciclo
  agente↔usuario, consulta directamente "Movimientos y recibos", y su
  única salida hacia el Backend/Orquestador es un **evento/trigger
  financiero estructurado** (ej. `LIQUIDITY_SHOCK_DETECTED`,
  `SERVICE_SPIKE_DETECTED`) — no una llamada de tool convencional del
  agente, sino un mensaje que activa al Agente financiero.

  Reglas de entrada ya definidas (coinciden con `spec.md` RF-01):
  - **Service Spike:** recibo muy superior al promedio histórico
    (spec.md lo formaliza en ≥ 40%).
  - **Golpe de liquidez:** cobro ≥ 75% del saldo actual (spec.md lo
    formaliza igual, y agrega un tercer trigger no dibujado en el
    diagrama: **renovación anual inminente** — anualidad con cobro
    previsto en ≤ 5 días. Hay que agregarlo al diagrama en la próxima
    iteración).

## Corrección: cuándo empieza el ciclo (aclaración clave del equipo)

En `02-banorte-contexto/03-decisiones-proyecto.md` se había dejado abierto
si el panel de componentes arranca vacío o ya con contenido proactivo. El
equipo ya lo aclaró: **el ciclo "agente↔UI" no arranca con el trigger del
motor de detección — arranca cuando el usuario interactúa con el warning
en su dashboard.**

Es decir, el flujo completo tiene dos momentos distintos:

1. **Estímulo invisible:** el motor de detección corre en segundo plano y,
   si detecta un desbalance, hace aparecer un **warning/banner** en el
   dashboard (esto es pasivo para el usuario — no genera aún una interfaz
   A2UI completa, solo una señal visual).
2. **Arranque del ciclo agente↔UI:** cuando el usuario **toca ese
   warning**, ahí es cuando se dispara la llamada al Agente financiero,
   que genera la interfaz (A2UI) con el detalle del problema y las
   soluciones — normalmente dentro de un **modal** — con datos gráficos, y
   de ahí en adelante todo funciona como el ciclo cerrado ya documentado
   (interacción → nueva acción/nueva interfaz) hasta la confirmación
   final.

Esto es importante para el frontend: el **banner/warning en el dashboard
NO es un componente generado por A2UI** — es un estado de la UI base de
la app (como cualquier badge de notificación), mientras que **todo lo que
aparece después de tocarlo (el modal con el detalle y las soluciones) sí
es contenido generado dinámicamente**. Ver el catálogo de componentes en
`02-catalogo-componentes.md`.

## Trigger financiero estructurado: forma tentativa del mensaje

Aunque falta definir el contrato exacto con el equipo de backend, una
forma razonable (alineada con `spec.md` RF-01 y el diagrama) sería:

```json
{
  "type": "LIQUIDITY_SHOCK_DETECTED",
  "userId": "usr_123",
  "detectedAt": "2026-09-16T09:03:00-06:00",
  "severity": "high",
  "payload": {
    "transactionId": "tx_789",
    "amount": 3500.00,
    "percentOfBalance": 0.82,
    "daysUntilNextPayroll": 6
  }
}
```

El Agente financiero recibe esto (vía el Agent Harness), decide cómo
narrarlo y qué tools de MCP llamar (`get_balance`, `simulate_plan`, etc.)
para construir la respuesta A2UI que verá el usuario al tocar el warning.
