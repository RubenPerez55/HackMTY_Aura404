import type { AgentEvent } from "./types.js";

export type EventHandler = (event: AgentEvent) => void;

/**
 * Bus de eventos en memoria, enrutado por `sessionId`.
 *
 * El stream SSE de cada sesión se suscribe aquí; el turn-runner emite
 * aquí cada fase del turno (inicio, tool_use, tool_result, fin, error).
 */
export class EventBus {
  private readonly bySession = new Map<string, Set<EventHandler>>();

  /** Se suscribe a los eventos de una sesión. Devuelve el unsubscribe. */
  subscribe(sessionId: string, handler: EventHandler): () => void {
    let set = this.bySession.get(sessionId);
    if (!set) {
      set = new Set();
      this.bySession.set(sessionId, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.bySession.delete(sessionId);
    };
  }

  /** Emite un evento para la sesión a la que pertenece. */
  emit(event: AgentEvent): void {
    const set = this.bySession.get(event.sessionId);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(event);
      } catch {
        // un suscriptor roto no debe interrumpir el resto.
      }
    }
  }

  /** Número de suscriptores activos de una sesión (diagnóstico). */
  subscriberCount(sessionId: string): number {
    return this.bySession.get(sessionId)?.size ?? 0;
  }
}