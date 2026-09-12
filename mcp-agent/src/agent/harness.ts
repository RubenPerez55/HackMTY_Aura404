import type { LlmMessage } from "../llm/types.js";

/**
 * Políticas de seguridad y configuración del agente.
 * Restringir `maxIterations` es la salvaguarda principal contra
 * bucles infinitos de tool calls.
 */
export interface AgentPolicy {
  /** Modelo LLM a utilizar (p. ej. `anthropic/claude-3.5-sonnet`). */
  model: string;
  /** Tope máximo de tokens a generar por turno. */
  maxTokens: number;
  /** Límite estricto de iteraciones del agent loop. */
  maxIterations: number;
  /** Prompt de sistema que define el rol y las instrucciones del agente. */
  systemPrompt: string;
}

export interface AgentConfig {
  policy: AgentPolicy;
  /** Mensaje inicial con la tarea (opcional; si se omite, arranca vacío y
   *  los estímulos llegan vía `appendUserMessage`). Se mantiene por
   *  retrocompatibilidad con el modo de un solo disparo. */
  task?: string;
  /** Historial opcional preexistente (memoria persistida). */
  initialHistory?: LlmMessage[];
}

/**
 * Harness: encapsula el estado del agente.
 *
 * Responsabilidades:
 *  - Mantener la memoria acumulativa (historial de mensajes).
 *  - Contar las iteraciones del bucle.
 *  - Aplicar la política de seguridad (límite de iteraciones).
 */
export class AgentHarness {
  readonly policy: AgentPolicy;
  private readonly messages: LlmMessage[];
  private iterations = 0;

  constructor(config: AgentConfig) {
    this.policy = config.policy;
    this.messages = [...(config.initialHistory ?? [])];
    if (config.task) {
      this.messages.push({ role: "user", content: [{ type: "text", text: config.task }] });
    }
  }

  /** Historial acumulativo inmutable para operaciones de solo lectura. */
  get history(): readonly LlmMessage[] {
    return this.messages;
  }

  /** Número de iteraciones consumidas en el turno actual. */
  get iterationCount(): number {
    return this.iterations;
  }

  /** `true` si el turno actual agotó su presupuesto de iteraciones. */
  get isExhausted(): boolean {
    return this.iterations >= this.policy.maxIterations;
  }

  /** Registra un nuevo mensaje en la memoria del agente. */
  append(message: LlmMessage): void {
    this.messages.push(message);
  }

  /** Añade un estímulo del usuario (nuevo turno de conversación). */
  appendUserMessage(text: string): void {
    this.messages.push({ role: "user", content: [{ type: "text", text }] });
  }

  /**
   * Inicia un turno nuevo: reinicia el contador de iteraciones.
   * `maxIterations` es el presupuesto POR TURNO (por estímulo del usuario),
   * no un tope global acumulado de la sesión.
   */
  beginTurn(): void {
    this.iterations = 0;
  }

  /** Consume una iteración del bucle. */
  advance(): void {
    this.iterations += 1;
  }

  /**
   * Verifica que queden iteraciones disponibles. Si no,
   * lanza un error controlado para detener el bucle.
   */
  assertRemainingIterations(): void {
    if (this.isExhausted) {
      throw new Error(
        `Límite de iteraciones alcanzado (${this.policy.maxIterations}). ` +
          "Se detuvo el agente para prevenir un bucle infinito.",
      );
    }
  }
}