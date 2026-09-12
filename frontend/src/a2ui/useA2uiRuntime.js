import { useReducer, useCallback } from "react";
import {
  createInitialState,
  applyA2uiMessage,
  listSurfaces,
} from "./reducer.js";

function reducer(state, message) {
  return applyA2uiMessage(state, message);
}

/**
 * Hook de React que envuelve el reducer de a2ui/reducer.js.
 *
 * Uso previsto (cuando el backend ya conecte el server `ui` real, ver
 * mcp-agent/src/mcp-servers/ui-server.ts): suscribirse a
 * `GET /api/sessions/:id/events` (SSE), y por cada evento
 * `tool.result` cuyo `name` sea `ui.render_component`, hacer
 * `JSON.parse(event.content)` (es un array de mensajes A2UI) y llamar
 * `applyMessages(...)` con ese array.
 *
 * Hoy (sin esa conexión todavía) sirve igual para probar/demostrar el
 * runtime con mensajes de ejemplo — ver a2ui/sampleMessages.js.
 */
export function useA2uiRuntime() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const applyMessage = useCallback((message) => dispatch(message), []);

  const applyMessages = useCallback((messages) => {
    for (const message of messages) dispatch(message);
  }, []);

  return {
    state,
    surfaces: listSurfaces(state),
    applyMessage,
    applyMessages,
  };
}
