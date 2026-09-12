# 1. ¿Qué es MCP?

**MCP (Model Context Protocol)** es un protocolo abierto, creado por
Anthropic (finales de 2024, ya adoptado por el ecosistema en general —
OpenAI, Google, herramientas como Claude Desktop, Cursor, VS Code, etc.),
que estandariza **cómo una aplicación de IA (un agente / un LLM) se conecta
con fuentes de datos, herramientas y sistemas externos.**

La analogía oficial y la más útil para explicarlo en un pitch:

> **MCP es como un puerto USB-C para aplicaciones de IA.**
> Antes de USB-C, cada dispositivo tenía su propio cable. MCP evita que
> cada agente tenga que integrarse "a mano" y de forma distinta con cada
> API, base de datos o servicio. Un servidor MCP se construye una vez y
> cualquier aplicación compatible con MCP lo puede consumir.

## El problema que resuelve

Sin MCP, si quieres que un agente de IA use N herramientas o fuentes de
datos (una base de datos, un CRM, el sistema de pagos, un scraper, etc.),
terminas escribiendo N integraciones distintas, cada una con su propio
formato de function-calling, su propia autenticación, su propio manejo de
errores. Esto no escala y no es reutilizable entre proyectos ni entre
distintos LLMs.

MCP propone un protocolo **único y estandarizado** entre:

- La aplicación que usa el LLM (el **Host**, ej. un chat, un IDE, una app
  bancaria con agente).
- Los sistemas externos que exponen capacidades (los **Servers**), ej.
  "consulta el saldo de una cuenta", "genera un reporte", "busca en la
  base de conocimiento".

## Puntos clave para el hackatón

- MCP **no es un LLM** ni reemplaza al modelo. Es la "tubería" (protocolo
  de comunicación) que conecta al modelo/agente con el mundo exterior de
  forma estandarizada.
- MCP **no decide qué hacer el agente** — la decisión de qué herramienta
  llamar la sigue tomando el LLM (via function/tool calling) o la lógica
  del host. MCP solo estandariza *cómo se describe* y *cómo se invoca* esa
  herramienta.
- Es especialmente relevante en el reto de Banorte porque en servicios
  financieros vas a tener múltiples sistemas (cuentas, transacciones,
  scoring de riesgo, KYC, etc.) que un agente necesita consultar de forma
  seguray auditable — ahí es donde MCP brilla: cada sistema se expone como
  un servidor MCP con permisos y alcance bien definidos.

Ver `04-glosario.md` para los términos exactos que vamos a usar en todo el
proyecto.
