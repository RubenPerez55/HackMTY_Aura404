/**
 * Probe CLI: conecta a un servidor MCP (sin LLM) para validar transporte,
 * listar herramientas y/o invocar una tool con argumentos JSON.
 *
 * Uso:
 *   npm run probe -- --url <url> --list [--token <t>]
 *   npm run probe -- --url <url> --call <tool> '<json>' [--token <t>]
 *   npm run probe -- --transport stdio --list   (usa MCP_SERVER_COMMAND/ARGS)
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";

import { McpClient } from "../src/mcp/client.js";
import { createTransport, resolveTransportFromEnv, type McpTransportConfig } from "../src/mcp/transport.js";

interface ProbeArgs {
  url?: string;
  token?: string;
  transport?: string;
  list: boolean;
  callName?: string;
  callInput: Record<string, unknown>;
}

function parseProbeArgs(argv: string[]): ProbeArgs {
  const args: ProbeArgs = { list: false, callInput: {} };
  const rest = argv.slice(2);

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    switch (arg) {
      case "--url":
        args.url = rest[++i];
        break;
      case "--token":
        args.token = rest[++i];
        break;
      case "--transport":
        args.transport = rest[++i];
        break;
      case "--list":
        args.list = true;
        break;
      case "--call":
        args.callName = rest[++i];
        args.callInput = parseJsonInput(rest[++i]);
        break;
      default:
        if (/^https?:\/\//i.test(arg)) args.url = arg;
        else throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return args;
}

function parseJsonInput(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error(`--call requiere un JSON válido como argumento. Ej.: '{"text":"hola"}'`);
  }
}

async function main(): Promise<void> {
  const args = parseProbeArgs(process.argv);
  const url = args.url ?? process.env.MCP_SERVER_URL;
  const token = args.token ?? process.env.MCP_TOKEN;

  const transportConfig: McpTransportConfig = resolveTransportFromEnv(
    { ...process.env, MCP_TRANSPORT: args.transport ?? process.env.MCP_TRANSPORT, MCP_SERVER_URL: url, MCP_TOKEN: token },
  );

  // Si se usa stdio y no hay comando explícito en env, conecta por defecto al servidor MCP bancario
  if (transportConfig.kind === "stdio" && !process.env.MCP_SERVER_COMMAND) {
    const serverScript = fileURLToPath(new URL("../src/mcp-server/banking-server.ts", import.meta.url));
    transportConfig.command = "npx";
    transportConfig.args = ["tsx", serverScript];
  }

  const mcpClient = new McpClient({
    transport: createTransport(transportConfig),
    clientInfo: { name: "mcp-probe", version: "1.0.0" },
  });

  try {
    await mcpClient.connect();
    const server = mcpClient.getServerInfo();
    const target = transportConfig.kind === "stdio" ? transportConfig.command : transportConfig.url;
    console.log(`[probe] Conectado (${transportConfig.kind}) a: ${target}`);
    if (server) console.log(`[probe] Servidor: ${server.name} v${server.version}`);

    const tools = await mcpClient.listToolsForLLM();
    console.log(`[probe] ${tools.length} herramientas:\n`);
    if (args.list) {
      for (const tool of tools) {
        console.log(`  - ${tool.name}`);
        if (tool.description) console.log(`      ${tool.description}`);
      }
    }

    if (args.callName) {
      const tool = tools.find((t) => t.name === args.callName);
      if (!tool) throw new Error(`Herramienta "${args.callName}" no encontrada.`);
      console.log(`\n[probe] Llamando ${tool.name}(${JSON.stringify(args.callInput)})...`);
      const result = await mcpClient.callTool(args.callName, args.callInput);
      console.log(`[probe] Resultado (${result.isError ? "error" : "ok"}):\n${result.content}`);
    } else if (!args.list) {
      console.log("\n[probe] Usa --list para verlas o --call <tool> '<json>' para invocar una.");
    }
  } catch (error) {
    console.error(
      "[probe] Error:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await mcpClient.close();
  }
}

void main();