import { randomUUID } from "node:crypto";

import { type LlmMessage } from "../../llm/types.js";
import type { SessionRecord, SessionStore } from "../storage/store.js";

/**
 * Gestor de sesiones por chat: crea, consulta y persiste conversaciones
 * en el almacén configurado (memoria + snapshot JSON opcional), y
 * garantiza que cada sesión procese sus turnos en orden (cola por id).
 */
export class SessionManager {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly store: SessionStore) {}

  create(userId: string, title?: string): SessionRecord {
    const now = new Date().toISOString();
    const record: SessionRecord = {
      id: randomUUID(),
      userId: userId || "anonymous",
      title: title?.trim() || "Nueva conversación",
      createdAt: now,
      updatedAt: now,
      history: [],
      turns: 0,
      status: "idle",
    };
    this.store.save(record);
    return record;
  }

  get(id: string): SessionRecord | undefined {
    return this.store.get(id);
  }

  list(userId?: string): SessionRecord[] {
    return this.store.list(userId);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  persist(record: SessionRecord): void {
    this.store.save(record);
  }

  isRunning(id: string): boolean {
    return this.queues.has(id);
  }

  /**
   * Encola una tarea por sesión: los turnos de un mismo chat se ejecutan
   * en orden estricto sin bloquear a las demás sesiones.
   */
  enqueue(id: string, task: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.then(() => task());
    this.queues.set(id, next);
    void next.finally(() => {
      if (this.queues.get(id) === next) this.queues.delete(id);
    });
    return next;
  }

  /** Convierte la memoria actual en un historial neutro para rehidratar `AgentHarness`. */
  historyOf(record: SessionRecord): LlmMessage[] {
    return [...record.history];
  }
}