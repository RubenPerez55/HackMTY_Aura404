import "dotenv/config";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BankDataSource } from "../data/data-source.js";
import { registerProfileTools } from "./tools/profile.tools.js";
import { registerPointsTools } from "./tools/points.tools.js";
import { registerDomiciliationTools } from "./tools/domiciliation.tools.js";
import { registerInstallmentsTools } from "./tools/installments.tools.js";
import { registerPayrollTools } from "./tools/payroll.tools.js";
import { registerSecurityTools } from "./tools/security.tools.js";

export interface BankingServerInstance {
  server: McpServer;
  data: BankDataSource;
}

/**
 * Fábrica del Servidor MCP Bancario de Banorte ShockAbsorber.
 * Registra el catálogo completo de herramientas de simulación y ejecución transaccional.
 */
export function createBankingMcpServer(dataDir?: string): BankingServerInstance {
  const data = new BankDataSource(dataDir ?? process.env.DATA_DIR);
  const server = new McpServer({
    name: "banorte-banking-mcp",
    version: "1.0.0",
  });

  registerSecurityTools(server);
  registerProfileTools(server, data);
  registerPointsTools(server, data);
  registerDomiciliationTools(server, data);
  registerInstallmentsTools(server, data);
  registerPayrollTools(server, data);

  return { server, data };
}

/**
 * Ejecución standalone del servidor MCP sobre transporte stdio.
 */
export async function runStdioServer(dataDir?: string): Promise<void> {
  const { server } = createBankingMcpServer(dataDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[banorte-banking-mcp] Servidor MCP Bancario conectado sobre transporte stdio.");
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  void runStdioServer();
}
