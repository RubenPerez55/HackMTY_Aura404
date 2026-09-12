/**
 * Eventos A2UI que el orquestador emite por sesión y que el frontend
 * recibe a través del stream SSE (`GET /api/sessions/:id/events`).
 *
 * Todos los eventos incluyen `sessionId` para que el bus pueda
 * enrutarlos sin ambigüedad.
 */
export type AgentEvent =
  | {
      type: "session.created";
      sessionId: string;
      userId: string;
      title: string;
      createdAt: string;
    }
  | {
      type: "turn.start";
      sessionId: string;
      turn: number;
      text: string;
    }
  | {
      type: "tool.use";
      sessionId: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool.result";
      sessionId: string;
      name: string;
      ok: boolean;
      content: string;
    }
  | {
      type: "turn.end";
      sessionId: string;
      finalAnswer: string | null;
      /**
       * Si `finalAnswer` es JSON válido de A2UI (ver
       * `src/agent/a2ui-contract.ts`), aquí van los mensajes ya
       * validados y listos para el runtime del frontend
       * (`frontend/src/a2ui/reducer.js`). `null` si el LLM respondió
       * en texto normal (la mayoría de los turnos) o si el JSON no
       * cumplió el contrato.
       */
      ui: import("../../agent/a2ui-contract.js").A2uiMessage[] | null;
      iterations: number;
      stoppedDueToLimit: boolean;
    }
  | {
      type: "turn.error";
      sessionId: string;
      message: string;
    }
  | {
      type: "session.closed";
      sessionId: string;
    };

/** `true` para los eventos que llevan `sessionId` (todos hoy). */
export type SessionScopedEvent = AgentEvent extends infer T
  ? T extends { sessionId: string }
    ? T
    : never
  : never;