# 4. Glosario rápido

- **MCP (Model Context Protocol):** protocolo abierto para conectar
  aplicaciones de IA con herramientas y datos externos de forma
  estandarizada.
- **Host:** la aplicación final (con el LLM adentro) que usa MCP. En
  nuestro proyecto: la app/agente para Banorte.
- **Client:** el componente dentro del Host que mantiene la conexión 1:1
  con un Server MCP y habla el protocolo.
- **Server:** el proceso que expone tools/resources/prompts sobre un
  dominio específico (ej. "cuentas bancarias", "scoring de crédito").
- **Tool:** función invocable por el modelo, con nombre, descripción y
  schema de entrada/salida.
- **Resource:** dato de contexto direccionable por URI.
- **Prompt (MCP):** plantilla de flujo reutilizable, invocada por el
  usuario.
- **Tool call:** el evento concreto de "el modelo decidió usar la tool X
  con estos parámetros".
- **JSON-RPC 2.0:** el formato de mensaje que usa MCP para pedir/responder
  cosas.
- **Transporte (transport):** el canal físico por el que viajan los
  mensajes JSON-RPC: `stdio` (proceso local) o `Streamable HTTP` (remoto).
- **Handshake / initialize:** el primer intercambio entre Client y Server
  donde negocian versión y capacidades soportadas.
- **Capabilities:** lo que un Client o Server declara soportar (tools,
  resources, prompts, sampling, etc.) durante el handshake.
- **Agentic UI / Generative UI:** patrón de frontend donde la interfaz no
  es fija, sino que se ensambla dinámicamente a partir de lo que el agente
  decide hacer (qué tool llamó, qué devolvió). *No es parte del spec de
  MCP* — es una capa de arquitectura de frontend que se construye encima.
  Ver `docs/01-agentic-ui-frontend/`.
- **MCP-UI:** propuesta/extensión de la comunidad (no parte del core spec
  oficial de Anthropic) que estandariza que un Server MCP pueda devolver,
  dentro del resultado de una tool, un recurso de tipo UI renderizable
  (HTML embebido, una URL para iframe, o "remote DOM"). Vale la pena
  investigarlo como referencia para el reto, pero hay que ser claros en
  que es un estándar aparte / complementario, no MCP "vanilla".
- **Function calling / Tool calling (del LLM):** la capacidad del modelo
  de, dado un set de herramientas disponibles, decidir cuál invocar y con
  qué argumentos. MCP estandariza cómo se *describen y exponen* esas
  herramientas al modelo, pero el mecanismo de "decidir cuál llamar" sigue
  siendo del LLM/orquestador.
