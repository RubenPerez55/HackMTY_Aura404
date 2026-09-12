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
 * Uso previsto (ver docs/03-arquitectura-tecnica/04-a2ui-generado-por-
 * el-agente.md — decisión final: el LLM compone el A2UI directamente,
 * no una tool de un Server MCP): suscribirse a
 * `GET /api/sessions/:id/events` (SSE), y por cada evento `turn.end`
 * cuyo campo `ui` no sea `null` (ya viene validado por el backend
 * contra `mcp-agent/src/agent/a2ui-contract.ts`), llamar
 * `applyMessages(event.ui)`.
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
