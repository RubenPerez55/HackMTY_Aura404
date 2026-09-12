import type { LlmTool } from "../../llm/types.js";
import type { AgentMcpClient, ToolExecutionResult } from "../../mcp/types.js";
import type { McpServerConnection } from "./registry.js";

/**
 * Cliente MCP agregado: expone las herramientas de todos los servers
 * del registro como una sola superficie al agent loop (interfaz
 * `AgentMcpClient`).
 *
 * - Los tools se cualifican como `<serverId>.<toolName>` para evitar
 *   colisiones (p. ej. `banking.consulta_saldo`, `impact.analizar`).
 * - `callTool` des-enruta por el prefijo `<serverId>.` hacia el server
 *   correcto.
 */
export class CompositeMcpClient implements AgentMcpClient {
  private readonly serverIds: Set<string>;

  constructor(private readonly servers: readonly McpServerConnection[]) {
    this.serverIds = new Set(servers.map((s) => s.serverId));
  }

  async listToolsForLLM(): Promise<LlmTool[]> {
    const tools: LlmTool[] = [];
    for (const { serverId, client } of this.servers) {
      const serverTools = await client.listToolsForLLM();
      for (const tool of serverTools) {
        tools.push({ ...tool, name: qualify(serverId, tool.name) });
      }
    }
    return tools;
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const { serverId, toolName } = this.resolveServer(name);

    const connection = this.servers.find((s) => s.serverId === serverId);
    if (!connection) {
      throw new Error(
        `Servidor MCP "${serverId}" no está conectado (tool "${name}"). ` +
          `Conectados: ${[...this.serverIds].join(", ") || "(ninguno)"}.`,
      );
    }
    return connection.client.callTool(toolName, input);
  }

  private resolveServer(name: string): { serverId: string; toolName: string } {
    const dot = name.indexOf(".");
    if (dot > 0) {
      const prefix = name.slice(0, dot);
      if (this.serverIds.has(prefix)) return { serverId: prefix, toolName: name.slice(dot + 1) };
    }
    if (this.servers.length === 1) return { serverId: this.servers[0].serverId, toolName: name };
    throw new Error(
      `Nombre de tool sin prefijo de servidor: "${name}". Usa "<serverId>.<toolName>".`,
    );
  }
}

function qualify(serverId: string, toolName: string): string {
  return `${serverId}.${toolName}`;
}