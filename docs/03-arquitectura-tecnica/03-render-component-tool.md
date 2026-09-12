# 3. La tool `render_component` — implementación real (paso 3 de A2UI)

> **⚠️ ACTUALIZACIÓN (superado):** después de discutirlo con el equipo de
> backend, se revirtió el diseño de este documento. El motivo: la propia
> lámina/diagrama del reto separa "MCP" (datos/herramientas/acciones) de
> "A2UI" (la interfaz, generada por el **Agente financiero**, no por un
> Server MCP) como dos piezas distintas — meter la generación de A2UI en
> un Server MCP contradecía esa separación. La decisión final está en
> `04-a2ui-generado-por-el-agente.md`. Este documento se deja como
> registro histórico de la primera iteración (y sigue siendo útil para
> entender el formato de los mensajes A2UI en sí, que no cambió).

Este documento cierra, con código ya probado, las dudas de arquitectura
que surgieron con el equipo de backend (¿el JSON se genera en el Harness
o en el Server? ¿hay un MCP server "para el front"?). Resumen de esas
decisiones, ya implementadas:

- **El JSON de A2UI se genera en un Server MCP, nunca en el
  `AgentHarness`/`AgentLoop`.** El Harness solo recuerda la conversación;
  el Loop solo orquesta llamadas a tools. Ver la explicación completa en
  el hilo de decisiones del proyecto.
- **No es un "server del frontend".** Es un Server MCP más, del mismo tipo
  que `banking` e `impact`, que vive del lado del backend. Se llama `ui`
  (prefijo de sus tools ante el LLM: `ui.render_component`) para
  distinguirlo de los servers de datos.

## Qué se construyó

### `mcp-agent/src/mcp-servers/ui-server.ts`

Un Server MCP (mismo patrón que `examples/echo-server.ts`, con
`McpServer` + `StdioServerTransport` del SDK oficial) que expone **una
sola tool: `render_component`**.

- **Input:** `component` (enum de `COMPONENT_CATALOG` — los mismos 5
  `uiHint` de `02-catalogo-componentes.md`: `service_spike_card`,
  `annual_fee_card`, `liquidity_shock_card`, `two_factor_modal`,
  `confirmation_receipt`) + `data` (objeto libre con los datos de ese
  componente).
- **Output:** un `content` de tipo `text` cuyo string es un **array de
  mensajes A2UI** (`createSurface` → `updateComponents` → `updateDataModel`),
  siguiendo la spec real de Google (ver el paso 2 de esta conversación).
- **No toca CSVs ni el banco.** Es una función pura de transformación —
  el agente ya trae los datos de otras tools (`banking.get_balance`,
  etc.) y solo le pide a esta que los empaquete como A2UI.

Importante sobre el formato de salida: `McpClient.callTool()` (en
`src/mcp/client.ts`) **solo conserva los bloques `type: "text"`** de la
respuesta de una tool y los concatena — por eso el server manda el array
de mensajes A2UI como un string JSON dentro de un bloque de texto, no como
un tipo de contenido estructurado aparte. Esto significa que, en el
frontend, el `content` de un evento `tool.result` para esta tool **hay
que parsearlo con `JSON.parse()`** antes de usarlo.

### `mcp-agent/src/backend/config.ts` (extendido)

El registro multi-server (`resolveMcpServersFromEnv`) antes solo sabía
armar servers remotos por HTTP (`MCP_<ID>_URL`). Se le agregó soporte
para servers **locales por stdio** (`MCP_<ID>_COMMAND` + `MCP_<ID>_ARGS`),
porque el server `ui` no necesita desplegarse en ningún lado — el propio
BFF lo levanta como subproceso. Ver `.env.example`:

```
MCP_UI_COMMAND=tsx
MCP_UI_ARGS=["src/mcp-servers/ui-server.ts"]
```

Con esto, en cuanto se agreguen esas dos líneas al `.env` real del
backend, `McpRegistry` conecta el server `ui` exactamente igual que a
`banking` o `impact` — no hace falta ningún otro cambio en
`server.ts`/`orchestrator.ts`.

### `frontend/src/a2ui/` (runtime mínimo)

Del lado del frontend se construyó el intérprete de estos mensajes:

- **`reducer.js`** — lógica pura (sin React): `applyA2uiMessage` /
  `applyA2uiMessages` mantienen un mapa de "surfaces" activas
  (`{ rootId, components, dataModel }`), y `resolveSurface` /
  `listSurfaces` las convierten en `{ component, catalogId, data }` listo
  para el component registry. A propósito **no implementa el 100% de la
  spec de A2UI** (JSON Pointer completo, funciones de renderer, catálogo
  Basic de Google) — solo lo que su propio server `ui` realmente emite
  (un componente raíz por surface, `path: "/"` siempre). Si el server
  evoluciona a mandar paths anidados, `setAtPointer` ya lo soporta.
- **`useA2uiRuntime.js`** — hook de React que envuelve el reducer con
  `useReducer`, listo para conectarse a la conexión SSE real.
- **`A2uiSurfaceView.jsx`** — el puente: toma una surface ya resuelta y
  monta el componente React correspondiente vía
  `componentRegistry.js` (el mismo registry que ya existía).
- **`sampleMessages.js`** — un fixture con mensajes A2UI reales
  (copiados de una corrida real de `ui-server.ts`), para probar el
  runtime sin depender de que el backend completo (LLM + banking real)
  ya esté funcionando.

## Prueba de integración ya corrida (backend ↔ frontend)

Se probó extremo a extremo, sin mocks: se invocó la tool
`render_component` de verdad (vía el SDK de MCP, transporte stdio) pidiendo
un `service_spike_card`, se tomó el JSON de salida **tal cual lo hubiera
recibido el frontend por SSE**, y se pasó por `reducer.js` del lado
frontend. Resultado: **interopera correctamente** — el componente y los
datos se resuelven bien en el otro extremo. Este es el primer punto de
contacto real entre lo que construye el equipo de backend (el Server MCP)
y lo que construye el equipo de frontend (el runtime + componentRegistry),
y ya quedó validado antes de que exista el agente LLM completo.

## Qué falta para la integración 100% en vivo (siguiente paso, no hecho aún)

1. En el backend real: agregar `MCP_UI_COMMAND`/`MCP_UI_ARGS` al `.env`,
   y que el `task.md`/system prompt del agente le explique al LLM cuándo
   usar `ui.render_component` (ahora mismo el agente no sabe que esta
   tool existe para "mostrar algo", más allá de que MCP se la liste).
2. En el frontend: sustituir `mockData.js`/`pendingTriggers` en `App.jsx`
   por una suscripción real a `GET /api/sessions/:id/events` (SSE), que
   filtre eventos `tool.result` con `name === "ui.render_component"`,
   haga `JSON.parse(event.content)` y llame `applyMessages(...)` del
   hook `useA2uiRuntime`.
3. Decidir cómo se marca "quítate" la alerta del dashboard cuando el
   ciclo termina (`deleteSurface`, o una convención propia) — hoy
   `App.jsx` lo resuelve con estado local (`triggers.filter(...)`), habría
   que unificarlo con el runtime real.

Este documento se puede volver a actualizar en cuanto se resuelvan esos
tres puntos.
