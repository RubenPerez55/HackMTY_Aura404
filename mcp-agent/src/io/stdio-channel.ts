import * as readline from "node:readline";

import type { AgentChannel, ChannelEvent } from "./channel.js";

const PROMPT = "tú> ";
const ASK_PROMPT = "agente> ";

/**
 * Canal terminal (stdio).
 *
 * Implementación actual del contrato `AgentChannel`: lee líneas de stdin,
 * escribe las respuestas en stdout y el estado en stderr (para no pisar el
 * prompt). Es el canal por defecto; no es usado por el resto del código.
 *
 * Internamente hace buffering (cola de eventos) para que los eventos del
 * stream no se pierdan aunque `nextEvent()` no esté esperando en ese momento
 * (p. ej. mientras el agente procesa un turno).
 */
export class StdioChannel implements AgentChannel {
  readonly name = "stdio";

  private rl: readline.Interface | null = null;
  private readonly queue: ChannelEvent[] = [];
  private readonly waiters: Array<(event: ChannelEvent | null) => void> = [];
  private eof = false;
  private closed = false;

  async open(): Promise<void> {
    if (this.rl) return;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdout.isTTY,
      prompt: PROMPT,
    });
    this.rl = rl;

    rl.on("line", (line) => this.push(parseLine(line)));
    rl.on("close", () => this.pushEof());
    rl.on("SIGINT", () => {
      this.sendStatus("recibido SIGINT. Cerrando sesión.");
      this.close();
    });

    process.stdout.write(`${ASK_PROMPT}Agente listo. Escribe /help para comandos.\n`);
  }

  nextEvent(): Promise<ChannelEvent | null> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.drain();
    });
  }

  send(text: string): void {
    const out = text === "" ? "(sin respuesta)" : text;
    process.stdout.write(`${ASK_PROMPT}${out}\n`);
  }

  sendStatus(text: string): void {
    process.stderr.write(`  ▸ ${text}\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const rl = this.rl;
    this.rl = null;
    if (rl) rl.close();
    // close() emite 'close' -> pushEof() drena a los waiters pendientes.
  }

  /* ------------------------------------------------------------------ */
  private push(event: ChannelEvent): void {
    if (this.closed) return;
    this.queue.push(event);
    this.drain();
  }

  private pushEof(): void {
    if (this.closed) return;
    this.eof = true;
    this.drain();
  }

  private drain(): void {
    while (this.waiters.length > 0 && (this.queue.length > 0 || this.eof)) {
      const waiter = this.waiters.shift()!;
      const event = this.queue.length > 0 ? this.queue.shift()! : null;
      waiter(event);
    }

    // Re-mostramos el prompt cuando el canal queda a la espera de input.
    if (this.queue.length === 0 && !this.eof && !this.closed) {
      this.rl?.prompt();
    }
  }
}

function parseLine(line: string): ChannelEvent {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return { type: "message", text: "" };
  }
  if (trimmed.startsWith("/")) {
    const [name, ...args] = trimmed.slice(1).split(/\s+/);
    return { type: "command", name, args };
  }
  return { type: "message", text: line };
}