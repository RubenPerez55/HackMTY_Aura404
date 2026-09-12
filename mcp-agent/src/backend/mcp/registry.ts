import { McpClient } from "../../mcp/client.js";
import { createTransport, type McpTransportConfig } from "../../mcp/transport.js";

export interface McpServerConfig {
  /** Identificador del server, p. ej. `banking` o `impact`. */
  id: string;
  transport: McpTransportConfig;
}

export interface McpServerConnection {
  serverId: string;
  client: McpClient;
}

/**
 * Registro de conexiones MCP del orquestador.
 *
 * Permite registrar N servidores (el bancario con los tools de operación
 * y el motor de detección de impacto, por ejemplo). Cada conexión se
 * crea con `McpClient` + `createTransport` del paquete del agente.
 */
export class McpRegistry {
  private readonly configs = new Map<string, McpServerConfig>();
  private readonly connections = new Map<string, McpClient>();

  register(config: McpServerConfig): void {
    this.configs.set(config.id, config);
  }

  /** Conecta todos los servers registrados. Los fallos se reportan pero no tiran el arranque. */
  async connectAll(): Promise<void> {
    for (const { id, transport } of this.configs.values()) {
      try {
        const client = new McpClient({
          transport: createTransport(transport),
          clientInfo: { name: "bff-orchestrator", version: "1.0.0" },
        });
        await client.connect();
        this.connections.set(id, client);
      } catch (error) {
        console.error(
          `[mcp] server "${id}" no conectado:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  get(id: string): McpClient | undefined {
    return this.connections.get(id);
  }

  /** Conexiones activas (server id y cliente) para el cliente compuesto. */
  entries(): McpServerConnection[] {
    return [...this.connections.entries()].map(([serverId, client]) => ({ serverId, client }));
  }

  connectedIds(): string[] {
    return [...this.connections.keys()];
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.connections.values()].map((client) => client.close()));
    this.connections.clear();
  }
}