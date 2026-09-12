# 2. Arquitectura y comunicación

## Los tres roles

MCP define tres actores. Es importante no confundirlos porque los tres
"MCP algo" (Host, Client, Server) se prestan a confusión:

1. **Host**
   La aplicación con la que interactúa el usuario final. Es quien contiene
   al LLM/agente y decide cuándo usar MCP. Ejemplos: Claude Desktop, un
   IDE, o —en nuestro caso— **la app/agente que construyamos para
   Banorte** (podría ser un chat, un dashboard, etc.).

2. **Client**
   Vive *dentro* del Host. Es el componente técnico que mantiene una
   conexión 1 a 1 con **un** Server MCP. Si el Host necesita hablar con 3
   servers distintos, instancia 3 clients (uno por cada conexión). El
   Client es quien habla el protocolo MCP en sí (JSON-RPC, handshake,
   etc.).

3. **Server**
   Un proceso (local o remoto) que expone capacidades: herramientas,
   datos, prompts. Es agnóstico de qué LLM lo está usando — un mismo
   server MCP puede servir a Claude, a GPT, a un agente propio, etc.

```
┌─────────────────────────── HOST ───────────────────────────┐
│   (la app / el agente que ve el usuario)                    │
│                                                              │
│   LLM  ⇄  [Client MCP #1] ⇄ ─── stdio/HTTP ───⇄  Server A    │
│        ⇄  [Client MCP #2] ⇄ ─── stdio/HTTP ───⇄  Server B    │
│        ⇄  [Client MCP #3] ⇄ ─── stdio/HTTP ───⇄  Server C    │
└──────────────────────────────────────────────────────────────┘
```

## Cómo se comunican (el protocolo)

- **Formato de mensaje:** [JSON-RPC 2.0](https://www.jsonrpc.org/). Todo
  mensaje es JSON con `method`, `params`, `id` (para requests) o `result`/
  `error` (para responses). También existen **notifications** (mensajes
  sin respuesta esperada, ej. "la lista de tools cambió").

- **Transporte (cómo viaja ese JSON):**
  - **stdio**: el Server corre como subproceso local del Host, y se
    comunican por stdin/stdout. Ideal para herramientas locales (leer
    archivos, correr scripts). Es el transporte más simple y el que se usa
    en desarrollo/demos.
  - **Streamable HTTP** (el transporte moderno para remoto, reemplaza al
    viejo "HTTP+SSE"): el Server es un servicio HTTP normal, expone un
    endpoint que puede responder JSON directo o abrir un stream
    (Server-Sent Events) cuando necesita mandar varios mensajes/eventos.
    Es el que usaríamos si el server vive en la nube (ej. un servicio de
    Banorte desplegado aparte del frontend).

- **Ciclo de vida de una conexión:**
  1. **initialize**: Client y Server negocian versión del protocolo y
     "capabilities" (qué soporta cada quien: tools, resources, prompts,
     sampling, etc.).
  2. **Operación normal**: requests/responses (ej. "list tools", "call
     tool X") y notifications (ej. "cambió la lista de recursos").
  3. **shutdown**: se cierra la conexión de forma ordenada.

## Por qué esto importa para el frontend (agentic UI)

El Host (nuestra app) es quien recibe el resultado de un `tool call` ya
resuelto por el Server. Ese resultado llega como **contenido estructurado**
(texto, JSON, imagen, o un recurso embebido), **no como un componente de
UI**. La decisión de qué componente visual usar para representar ese
resultado es una capa que se construye *encima* de MCP, en el Host/frontend
— no es parte del protocolo en sí. Esto se detalla en
`docs/01-agentic-ui-frontend/`.
