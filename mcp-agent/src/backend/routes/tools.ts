import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { LlmTool } from "../../llm/types.js";
import type { RouteDeps } from "./types.js";

/**
 * Gestiona las rutas de catálogo: lista la superficie de herramientas
 * que el frontend puede exponer como contratos A2UI.
 */
export function registerTools(app: FastifyInstance, deps: RouteDeps): void {
  app.get("/api/tools", async (_request: FastifyRequest, reply: FastifyReply) => {
    const servers: Array<{ serverId: string; tools: LlmTool[] }> = [];
    for (const { serverId, client } of deps.registry.entries()) {
      const tools = (await client.listToolsForLLM()).map((tool) => ({
        ...tool,
        name: `${serverId}.${tool.name}`,
      }));
      servers.push({ serverId, tools });
    }
    return reply.send({ servers });
  });
}