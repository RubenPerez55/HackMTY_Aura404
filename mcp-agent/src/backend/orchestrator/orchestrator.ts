import { EventBus } from "../events/bus.js";
import { SessionManager } from "./session-manager.js";
import { TurnRunner } from "./turn-runner.js";
import type { SessionRecord } from "../storage/store.js";

export interface OrchestratorOptions {
  bus: EventBus;
  manager: SessionManager;
  runner: TurnRunner;
}

export interface SendMessageResult {
  sessionId: string;
  /** `true` si el turno se encoló (aún había uno en curso en la sesión). */
  queued: boolean;
}

export interface ImpactTriggerPayload {
  userId?: string;
  sessionId?: string;
  message?: string;
  event?: unknown;
}

/**
 * Orquestador: fachada que conecta el API REST con el agente.
 *
 * Responsabilidades:
 *  - Crear/continuar sesiones por chat con su historial persistido.
 *  - Recibir mensajes del usuario y lanzar un turno por cada uno.
 *  - Recibir el detonante del motor de detección de impacto y arrancar
 *    la conversación del agente con el usuario (usando los tools del
 *    server bancario).
 */
export class Orchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  createSession(userId: string, title?: string): SessionRecord {
    const session = this.options.manager.create(userId, title);
    this.options.bus.emit({
      type: "session.created",
      sessionId: session.id,
      userId: session.userId,
      title: session.title,
      createdAt: session.createdAt,
    });
    return session;
  }

  getSession(id: string): SessionRecord | undefined {
    return this.options.manager.get(id);
  }

  listSessions(userId?: string): SessionRecord[] {
    return this.options.manager.list(userId);
  }

  async deleteSession(id: string): Promise<boolean> {
    const ok = this.options.manager.delete(id);
    if (ok) this.options.bus.emit({ type: "session.closed", sessionId: id });
    return ok;
  }

  /**
   * Acepta un mensaje del usuario para una sesión.
   *
   * El turno se encola por sesión y sus fases se transmiten por SSE
   * (`GET /api/sessions/:id/events`). La respuesta HTTP vuelve al instante
   * con el id; no espera a que el agente termine.
   */
  sendMessage(sessionId: string, text: string): SendMessageResult {
    if (!this.options.manager.get(sessionId)) {
      throw new Error(`Sesión "${sessionId}" no existe.`);
    }
    const queued = this.options.manager.isRunning(sessionId);

    void this.options.manager
      .enqueue(sessionId, () => this.options.runner.runTurn(sessionId, text))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[orchestrator] Turno de "${sessionId}" falló: ${message}`);
      });

    return { sessionId, queued };
  }

  /**
   * Detonante del motor de detección de impacto.
   *
   * Si el `sessionId` existe continúa esa conversación; si no, abre una
   * sesión nueva para el usuario y siembra el estímulo derivado del evento
   * detectado, que el agente responderá usando el server bancario.
   */
  triggerImpact(payload: ImpactTriggerPayload): { session: SessionRecord; queued: boolean } {
    const userId = payload.userId ?? "anonymous";
    const existingSession = payload.sessionId
      ? this.options.manager.get(payload.sessionId)
      : undefined;
    const session =
      existingSession ?? this.createSession(userId, "Impacto financiero detectado");

    const stimulus = payload.message?.trim() || buildImpactStimulus(payload.event, userId);
    const { queued } = this.sendMessage(session.id, stimulus);

    return { session, queued };
  }
}

/**
 * Traduce un evento crudo del motor de impacto a un estímulo en español.
 *
 * OJO: este texto es el primer mensaje que ve el agente para este flujo,
 * así que le marca el tono de la respuesta. Ahora es explícito: reunir datos
 * con las tools y responder con el JSON de componentes, no con texto.
 */
function buildImpactStimulus(event: unknown, userId?: string): string {
  const detail = event ? `: ${JSON.stringify(event)}` : "";
  const clientDirective = userId
    ? `El cliente bancario afectado es "${userId}". Usa siempre exactamente "${userId}" como argumento 'usuario' en todas tus herramientas bancarias MCP. `
    : "";
  return (
    `Se detectó un impacto financiero en la cuenta del usuario${userId ? ` "${userId}"` : ""}` +
    `${detail}. ` +
    clientDirective +
    "Explora activamente la situación y evalúa alternativas viables usando las " +
    "herramientas bancarias MCP (calendario y subsistencia de nómina, simulaciones de " +
    "plazos/MSI, adelanto de nómina, puntos de fidelidad, etc.). Razona las mejores opciones " +
    "financieras sin redundancias y compone la pantalla de solución combinando los componentes " +
    "de tu catálogo A2UI (ver 'Generación de interfaz (A2UI)' en tus instrucciones). " +
    "Tu respuesta final para este estímulo DEBE ser el arreglo JSON de " +
    "componentes -- no le respondas al usuario con una explicación en texto plano."
  );
}