import type { AgentChannel } from "../io/channel.js";
import type { LlmProvider } from "../llm/provider.js";
import type { AgentMcpClient } from "../mcp/types.js";
import { AgentHarness, type AgentPolicy } from "./harness.js";
import { AgentLoop } from "./loop.js";

export interface AgentSessionOptions {
  /** Cliente MCP ya conectado (o que el orquestador conectará). */
  mcpClient: AgentMcpClient;
  llm: LlmProvider;
  policy: AgentPolicy;
  channel: AgentChannel;
}

export interface AgentSessionResult {
  turns: number;
}

const HELP_TEXT = [
  "Comandos disponibles:",
  "  /help          - esta ayuda",
  "  /tools         - lista las herramientas MCP disponibles",
  "  /quit          - cierra la sesión",
  "",
  "Cualquier otro texto se envía al agente como estímulo.",
].join("\n");

/**
 * Sesión interactiva del agente: escucha los estímulos del canal y, por
 * cada mensaje del usuario, ejecuta un turno completo del loop LLM <-> MCP.
 *
 * Es agnóstico al medio: no toca la terminal directamente, solo `AgentChannel`.
 */
export class AgentSession {
  private readonly mcpClient: AgentMcpClient;
  private readonly harness: AgentHarness;
  private readonly loop: AgentLoop;
  private readonly channel: AgentChannel;
  private turns = 0;

  constructor(options: AgentSessionOptions) {
    this.mcpClient = options.mcpClient;
    this.harness = new AgentHarness({ policy: options.policy });
    this.loop = new AgentLoop({
      mcpClient: options.mcpClient,
      harness: this.harness,
      llm: options.llm,
      onToolUse: (name, input) => {
        const args = summary(input);
        this.channel.sendStatus(`ejecutando herramienta "${name}"${args ? ` con ${args}` : ""}…`);
      },
    });
    this.channel = options.channel;
  }

  async run(): Promise<AgentSessionResult> {
    await this.channel.open();
    this.channel.sendStatus(`canal "${this.channel.name}" abierto. Escribe /help para comandos.`);

    try {
      while (true) {
        const event = await this.channel.nextEvent();
        if (event === null) break;

        if (event.type === "eof") {
          this.channel.sendStatus("fin del stream. Cerrando sesión.");
          break;
        }

        if (event.type === "command") {
          if (await this.handleCommand(event.name, event.args)) break;
          continue;
        }

        if (event.type === "message") {
          const text = event.text.trim();
          if (text.length === 0) continue;
          await this.runTurn(text);
        }
      }
    } finally {
      this.channel.close();
    }

    return { turns: this.turns };
  }

  private async runTurn(userMessage: string): Promise<void> {
    this.turns += 1;
    this.harness.beginTurn();
    this.harness.appendUserMessage(userMessage);

    this.channel.sendStatus(
      `turno ${this.turns} (presupuesto de ${this.harness.policy.maxIterations} iteraciones)`,
    );

    const result = await this.loop.run();

    if (result.finalAnswer) {
      this.channel.send(result.finalAnswer);
    } else if (result.stoppedDueToLimit) {
      this.channel.sendStatus(
        `turno detenido por agotar el límite de ${this.harness.policy.maxIterations} iteraciones.`,
      );
      this.channel.send("No pude completar la respuesta en el presupuesto de iteraciones.");
    }

    this.channel.sendStatus(`turno ${this.turns} terminado (${result.iterations} iteraciones).`);
  }

  private async handleCommand(name: string, _args: string[]): Promise<boolean> {
    switch (name.toLowerCase()) {
      case "quit":
      case "exit":
        this.channel.sendStatus("saliendo…");
        return true;

      case "tools": {
        const tools = await this.mcpClient.listToolsForLLM();
        if (tools.length === 0) {
          this.channel.send("El servidor MCP no expone herramientas.");
        } else {
          const listing = tools.map((t) => `  • ${t.name}: ${t.description || "(sin descripción)"}`).join("\n");
          this.channel.send(`Herramientas disponibles:\n${listing}`);
        }
        return false;
      }

      case "help":
        this.channel.send(HELP_TEXT);
        return false;

      default:
        this.channel.sendStatus(`comando desconocido: /${name}. Usa /help.`);
        return false;
    }
  }
}

/** Resumen corto y legible de los argumentos de un tool para el status. */
function summary(input: Record<string, unknown>): string {
  const entries = Object.entries(input).slice(0, 3);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}=${stringify(v)}`).join(", ");
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  try {
    const json = JSON.stringify(value);
    return json.length > 40 ? `${json.slice(0, 40)}…` : json;
  } catch {
    return String(value);
  }
}