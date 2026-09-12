# 2. Cómo se comunica el frontend con el resto del MCP

Un punto importante: **el frontend normalmente no habla MCP directamente.**
MCP fue diseñado para comunicación entre un Host (una app con un LLM
embebido, ej. un backend/orquestador) y Servers. Un frontend web (React,
etc.) típicamente:

- No abre una conexión MCP (stdio o Streamable HTTP) él mismo.
- Habla con **su propio backend/orquestador** (que sí actúa como Host/
  Client MCP) vía una API normal (REST, WebSocket, o streaming tipo SSE).
- Ese backend es quien tiene el LLM, decide qué tools llamar, gestiona los
  Clients MCP hacia cada Server, y le regresa al frontend el resultado ya
  resuelto (texto + datos estructurados del tool call).

```
┌───────────┐   HTTP/WS/SSE   ┌────────────────────────────┐   MCP (JSON-RPC)   ┌───────────────┐
│  FRONTEND │ ───────────────▶│   BACKEND / ORQUESTADOR      │────────────────────▶│  Servers MCP   │
│ (React)   │◀─────────────── │   (Host + LLM + Clients MCP) │◀────────────────────│ (cuentas, etc) │
└───────────┘   stream de     └────────────────────────────┘                     └───────────────┘
                eventos UI
```

Esto es clave porque cambia qué le corresponde a "mi parte" (frontend):

- **No** me toca implementar el protocolo MCP (JSON-RPC, handshake,
  transports). Eso vive en el backend/orquestador.
- **Sí** me toca diseñar el **contrato de eventos** entre el backend y el
  frontend: cómo le llega al frontend la información de "qué tool se
  llamó" y "qué datos regresó", para poder decidir qué componente
  renderizar.

## Cómo debería verse ese contrato de eventos

Para que el "Agentic UI" funcione, cada respuesta que el backend manda al
frontend debería incluir, como mínimo:

```json
{
  "type": "tool_result",
  "toolName": "simulate_loan",
  "uiHint": "loan_simulation_card",
  "data": {
    "monthlyPayment": 2350.50,
    "totalInterest": 8420.00,
    "termMonths": 24
  }
}
```

- `toolName`: el nombre real de la tool MCP que se ejecutó (trazabilidad).
- `uiHint` (propuesta nuestra, no es parte de MCP): un identificador
  explícito de qué tipo de componente usar. Es más robusto que inferir el
  componente solo del `toolName`, porque desacopla "qué hace la tool" de
  "cómo se ve" — una misma tool podría en el futuro sugerir distintas
  vistas según el contexto.
- `data`: el payload con la forma que ese componente espera.

Si el streaming es en tiempo real (recomendado para que se sienta
"agéntico" — ver el texto/UI aparecer progresivamente), esto normalmente
se transmite por **Server-Sent Events (SSE)** o un **WebSocket**, mandando
varios eventos según van pasando cosas: `token` (texto del LLM),
`tool_call_start`, `tool_result` (el evento que dispara el render de UI),
`done`.

## Qué preguntar al equipo de backend en cuanto se defina el stack

- ¿El backend va a exponer un endpoint de streaming (SSE/WS) o va a ser
  request/response simple? (afecta mucho cómo se siente la UI)
- ¿Van a estandarizar un campo tipo `uiHint` en la respuesta, o el
  frontend tiene que inferir el componente solo del nombre de la tool?
- ¿Qué tan estables van a ser los `inputSchema`/`outputSchema` de cada
  tool? (si cambian mucho, el registro de componentes se rompe seguido)
