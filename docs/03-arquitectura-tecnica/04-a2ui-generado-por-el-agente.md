# 4. Decisión final: el LLM genera el A2UI, MCP se queda solo con datos

Este documento reemplaza el diseño de `03-render-component-tool.md`
(dejado como registro histórico). Resume la discusión del equipo y el
código que ya se implementó y probó.

## La objeción del equipo (y por qué tenían razón)

El diseño anterior metía la generación de A2UI dentro de una tool de un
Server MCP nuevo (`ui.render_component`). El equipo de backend lo
cuestionó: **"el JSON lo debe crear el agente, y el MCP server debe
solamente brindar información sobre sus tools, no JSON."**

Revisando la propia lámina del reto y el diagrama de arquitectura que ya
habíamos documentado, tenían razón: ahí, "MCP" (datos, herramientas y
acciones) y "A2UI" (la interfaz, que genera el **Agente financiero**) se
presentan como dos piezas separadas de las tres no-negociables — nunca se
dijo que A2UI viviera adentro de un Server MCP. El diseño anterior
mezclaba dos responsabilidades que el propio reto ya distinguía.

## Cómo quedó

**Los Servers MCP (`banking`, `impact`) se quedan puros:** solo dan datos
y ejecutan acciones (`get_balance`, `get_transactions`, `simulate_plan`,
etc.). Ninguno arma JSON de interfaz.

**El LLM compone el A2UI directamente**, como su respuesta final de
texto — no a través de ninguna tool. Ya trae los datos porque los pidió
antes con las tools normales de `banking`/`impact`; su última respuesta,
cuando aplica, es el arreglo JSON de A2UI en sí.

**El "contrato" que se mencionó en la plática con el equipo** ya está
implementado: `mcp-agent/src/agent/a2ui-contract.ts`. Es el catálogo de
los 5 componentes (mismo catálogo que ya existía en
`02-catalogo-componentes.md` y en `frontend/src/components/
componentRegistry.js`) más un validador con `zod`
(`parseA2uiAnswer(text)`) que:

1. Intenta parsear la respuesta del LLM como JSON.
2. Valida que cumpla la forma de los 3 mensajes A2UI que usamos
   (`createSurface`/`updateComponents`/`updateDataModel`).
3. Cruza los datos de cada `updateDataModel` contra el schema del
   componente correspondiente (ej. que `service_spike_card` sí traiga
   `overageAmount`, `pointsAvailable`, etc.)

Si algo de esto falla, el turno se trata como una respuesta de texto
normal — no rompe nada, solo no hay UI que mostrar ese turno. Esto le
devuelve al diseño la red de seguridad que preocupaba de la opción "LLM
escribe JSON a mano": el backend valida antes de mandar nada al
frontend.

## Dónde se engancha

`mcp-agent/src/backend/orchestrator/turn-runner.ts` — al terminar el
turno (`loop.run()`), se llama `parseA2uiAnswer(result.finalAnswer)` y el
resultado (los mensajes ya validados, o `null`) se manda como campo `ui`
dentro del evento `turn.end` (ver `events/types.ts`), junto al
`finalAnswer` de siempre. El frontend, al recibir un `turn.end` por SSE,
revisa: si `event.ui` no es `null`, son mensajes A2UI listos para
`useA2uiRuntime().applyMessages(event.ui)` (ver
`frontend/src/a2ui/reducer.js` — esa parte **no cambió**, sigue
interpretando los mismos 3 tipos de mensaje sin importar quién los
generó). Si `event.ui` es `null`, es una respuesta conversacional normal.

## Qué se le explicó al LLM

`mcp-agent/task.md` ahora incluye, en la sección "Generación de
interfaz (A2UI)", el catálogo completo y la forma exacta del JSON que
debe producir, con la regla explícita de responder en texto normal
cuando el estímulo no corresponde a ninguno de los 5 componentes. Es un
primer borrador de prompt — como todo prompt, seguramente necesite
ajustes una vez que se pruebe con el LLM real; vale la pena revisarlo en
equipo.

## Qué se eliminó

- `mcp-agent/src/mcp-servers/ui-server.ts` (el Server MCP `ui`).
- Las variables `MCP_UI_COMMAND`/`MCP_UI_ARGS` de `.env.example`.

## Qué falta para la integración 100% en vivo

1. Probar con el LLM real (hoy solo se probó el validador con JSON
   escrito a mano en un test, no con una respuesta real de un modelo).
   Es posible que el prompt de `task.md` necesite ejemplos few-shot si el
   modelo no sigue el formato a la primera.
2. En el frontend: sustituir `mockData.js`/`pendingTriggers` en
   `App.jsx` por una suscripción real a `GET /api/sessions/:id/events`
   (SSE) que, en cada evento `turn.end` con `ui` no nulo, llame
   `applyMessages`.
3. Decidir la convención para "retirar" una alerta del dashboard cuando
   el ciclo termina (hoy `App.jsx` lo resuelve con estado local).
