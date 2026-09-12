/**
 * Canal de estímulos del agente.
 *
 * La sesión del agente no sabe nada del medio físico (terminal, HTTP,
 * WebSocket, colas...): solo conoce este contrato. Cada "evento" es un
 * estímulo que debe procesar (mensaje del usuario) o un control del canal
 * (comando o fin de stream).
 *
 * Para conectar otro medio basta con implementar `AgentChannel` y
 * registrarlo en `src/io/factory.ts`.
 */

export type ChannelEvent =
  | { type: "message"; text: string }
  | { type: "command"; name: string; args: string[] }
  | { type: "eof" };

export interface AgentChannel {
  /** Identificador legible del canal (para logs y config). */
  readonly name: string;
  /** Abre el canal y deja listo para entregar eventos. */
  open(): Promise<void>;
  /**
   * El siguiente evento disponible, o `null` si el canal se cerró
   * (EOF / shutdown) y no habrá más estímulos.
   */
  nextEvent(): Promise<ChannelEvent | null>;
  /** Entrega la respuesta del agente al usuario. */
  send(text: string): void;
  /** Entrega mensajes de estado/diagnóstico (no es respuesta final). */
  sendStatus(text: string): void;
  /** Cierra el canal liberando recursos. Idempotente. */
  close(): void;
}