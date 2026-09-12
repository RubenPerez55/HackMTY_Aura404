import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Implementation, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { LlmTool } from "../llm/types.js";
import type { ToolExecutionResult } from "./types.js";

/**
 * Opciones del cliente MCP. El transporte (stdio, SSE o HTTP) ya está
 * construido por `src/mcp/transport.ts`; este cliente es agnóstico al medio.
 */
export interface McpClientOptions {
  transport: Transport;
  clientInfo?: { name: string; version: string };
}

/**
 * Cliente MCP orientado al agente.
 *
 * Encapsula el ciclo de vida completo: negociar protocolo, listar
 * herramientas, invocarlas y cerrar los recursos de forma segura e
 * idempotente. Funciona igual con stdio, Streamable HTTP o SSE.
 */
export class McpClient {
  private readonly options: McpClientOptions;
  private client: Client | null = null;

  constructor(options: McpClientOptions) {
    this.options = options;
  }

  /** `true` cuando el cliente está conectado y listo para operar. */
  get isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Inicializa la conexión con el servidor. Lanza si el arranque falla
   * o el servidor no anuncia capacidades de herramientas.
   */
  async connect(): Promise<void> {
    const clientInfo = this.options.clientInfo ?? { name: "mcp-agent", version: "1.0.0" };
    const client = new Client(clientInfo, { capabilities: {} });
    await client.connect(this.options.transport);

    this.client = client;

    const capabilities = client.getServerCapabilities();
    if (!capabilities?.tools) {
      throw new Error(
        "El servidor MCP no anuncia capacidad de herramientas (tools).",
      );
    }
  }

  /** Información reportada por el servidor (nombre y versión). */
  getServerInfo(): Implementation | undefined {
    return this.client?.getServerVersion();
  }

  /**
   * Descubre las herramientas del servidor y las normaliza al formato
   * de esquemas que esperan los LLMs (Anthropic `input_schema` /
   * OpenAI `parameters`).
   */
  async listToolsForLLM(): Promise<LlmTool[]> {
    const raw = await this.requireClient().listTools();
    return raw.tools.map((tool: Tool): LlmTool => {
      // MCP garantiza `type: "object"` en inputSchema, que es justo lo que
      // exige Anthropic y acepta OpenAI.
      const { inputSchema } = tool;
      const schema = inputSchema as unknown as LlmTool["input_schema"];
      if (schema.type !== "object") {
        throw new Error(
          `La herramienta "${tool.name}" no declara un inputSchema de tipo object.`,
        );
      }
      return { name: tool.name, description: tool.description ?? "", input_schema: schema };
    });
  }

  /**
   * Ejecuta una herramienta en el servidor remoto.
   *
   * Normaliza el resultado: concatena los bloques `text` en un solo
   * string e informa si la ejecución remota terminó en error.
   */
  async callTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const response = await this.requireClient().callTool({ name, arguments: input });

    // El tipo de retorno de callTool usa un índice [x: string]: unknown;
    // extraemos content con un cast explícito para iterar con seguridad.
    const content = (response as { content: Array<{ type: string; text?: string }> }).content;

    const textBlocks = content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "");

    return {
      content: textBlocks.join("\n"),
      isError: response.isError === true,
    };
  }

  /**
   * Cierra la conexión y finaliza los recursos del transporte.
   * Es idempotente: llamarlo varias veces es seguro pero solo actúa una vez.
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private requireClient(): Client {
    if (!this.client) {
      throw new Error("McpClient no conectado. Llama a connect() primero.");
    }
    return this.client;
  }
}