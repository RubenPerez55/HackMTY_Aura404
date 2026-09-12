/**
 * Servidor MCP de prueba que expone dos herramientas sobre transport stdio.
 * Úsalo para verificar el agente:
 *   MCP_SERVER_COMMAND="node" MCP_SERVER_ARGS="[\"dist/examples/echo-server.js\"]" npm run dev
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "echo-server", version: "0.1.0" });

server.registerTool(
  "echo",
  { description: "Devuelve el mismo texto que recibe.", inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: "text", text }] }),
);

server.registerTool(
  "add",
  { description: "Suma dos números.", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
);

await server.connect(new StdioServerTransport());