import { AgentHarness, type AgentPolicy } from "../../agent/harness.js";
import { AgentLoop } from "../../agent/loop.js";
import { parseA2uiAnswer } from "../../agent/a2ui-contract.js";
import type { LlmProvider } from "../../llm/provider.js";
import type { AgentMcpClient } from "../../mcp/types.js";
import { EventBus } from "../events/bus.js";
import { SessionManager } from "./session-manager.js";

export interface TurnRunnerOptions {
  bus: EventBus;
  manager: SessionManager;
  llm: LlmProvider;
  policy: AgentPolicy;
  mcpClient: AgentMcpClient;
}

/**
 * Driver por-turno del agente para el backend.
 *
 * A diferencia de `AgentSession` (bucle interactivo bloqueante pensado
 * para terminal), aquí cada estímulo del usuario se resuelve en un turno
 * independiente:
 *   1. Rehidrata `AgentHarness` con la memoria persistida de la sesión.
 *   2. Ejecuta el `AgentLoop` LLM <-> MCP reutilizando el código del agente.
 *   3. Emite cada fase al bus de eventos (SSE) y persiste el historial.
 */
export class TurnRunner {
  constructor(private readonly options: TurnRunnerOptions) {}

  async runTurn(sessionId: string, userText: string): Promise<void> {
    const { bus, manager, llm, policy, mcpClient } = this.options;
    const session = manager.get(sessionId);
    if (!session) throw new Error(`Sesión "${sessionId}" no existe.`);

    session.status = "running";
    session.updatedAt = new Date().toISOString();
    manager.persist(session);

    const harness = new AgentHarness({ policy, initialHistory: manager.historyOf(session) });
    harness.beginTurn();
    harness.appendUserMessage(userText);

    const turnNumber = session.turns + 1;
    bus.emit({
      type: "turn.start",
      sessionId,
      turn: turnNumber,
      text: userText,
    });

    const loop = new AgentLoop({
      mcpClient,
      harness,
      llm,
      onToolUse: (name, input) => bus.emit({ type: "tool.use", sessionId, name, input }),
      onToolResult: (name, _input, result) =>
        bus.emit({
          type: "tool.result",
          sessionId,
          name,
          ok: !result.isError,
          content: result.content,
        }),
    });

    try {
      const result = await loop.run();

      session.history = harness.history as typeof session.history;
      session.turns = turnNumber;
      session.status = "idle";
      session.lastError = undefined;
      session.updatedAt = new Date().toISOString();

      // El LLM compone el A2UI el mismo (no un server MCP -- ver decisión
      // del equipo en docs/03-arquitectura-tecnica/04-a2ui-generado-por-
      // el-agente.md). Aquí solo VALIDAMOS su respuesta contra el
      // contrato antes de mandarla al frontend; si no es A2UI válido,
      // `ui` queda en null y el frontend lo trata como texto normal.
      const parsedUi = parseA2uiAnswer(result.finalAnswer);
      if (!parsedUi.ok) {
        // Visibilidad para depurar: si el LLM iba a mandar A2UI y el
        // contrato lo rechazó (campo faltante, componente inventado,
        // etc.), esto se veía en el frontend como "el agente sigue
        // contestando en texto plano" sin ninguna pista del porqué.
        console.warn(
          `[a2ui] turno ${sessionId}#${turnNumber}: respuesta tratada como texto plano -- ${parsedUi.reason}`,
        );
      }

      bus.emit({
        type: "turn.end",
        sessionId,
        finalAnswer: result.finalAnswer,
        ui: parsedUi.ok ? parsedUi.messages : null,
        iterations: result.iterations,
        stoppedDueToLimit: result.stoppedDueToLimit,
      });
    } catch (error) {
      session.status = "error";
      session.lastError = error instanceof Error ? error.message : String(error);
      session.updatedAt = new Date().toISOString();
      bus.emit({ type: "turn.error", sessionId, message: session.lastError });
      throw error;
    } finally {
      manager.persist(session);
    }
  }
}