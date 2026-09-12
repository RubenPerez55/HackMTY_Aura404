import "dotenv/config";

import { readFile } from "node:fs/promises";

import { AgentSession } from "./agent/session.js";
import type { AgentPolicy } from "./agent/harness.js";
import { McpClient } from "./mcp/client.js";
import { createTransport, resolveTransportFromEnv, type McpTransportConfig } from "./mcp/transport.js";
import { createLlmProvider, type LlmProviderConfig } from "./llm/provider.js";
import { createChannel } from "./io/factory.js";

interface AppConfig {
  transportConfig: McpTransportConfig;
  llmConfig: LlmProviderConfig;
  policy: AgentPolicy;
}

/** Toma la URL del servidor como primer argumento posicional http(s). */
function positionalUrl(argv: string[]): string | undefined {
  return argv.slice(2).find((arg) => /^https?:\/\//i.test(arg));
}

/**
 * Resuelve el prompt de sistema (rol del agente):
 *  1. `AGENT_SYSTEM_PROMPT` si está definido.
 *  2. El archivo `AGENT_TASK_FILE`, o `./task.md` por defecto si existe.
 *  3. Fallback breve si no hay nada.
 */
async function resolveSystemPrompt(): Promise<string> {
  if (process.env.AGENT_SYSTEM_PROMPT) return process.env.AGENT_SYSTEM_PROMPT;

  const candidates = process.env.AGENT_TASK_FILE
    ? [process.env.AGENT_TASK_FILE]
    : ["./task.md"];

  for (const path of candidates) {
    try {
      const content = await readFile(path, "utf8");
      const trimmed = content.trim();
      if (trimmed.length > 0) return trimmed;
    } catch {
      // el archivo no existe o no es legible: probamos el siguiente.
    }
  }

  return (
    "Eres un agente autónomo que usa las herramientas MCP disponibles para " +
    "resolver los estímulos del usuario. Si el usuario necesita alguna acción " +
    "que las herramientas permiten, ejecútala. Explica brevemente tus pasos."
  );
}

function loadConfig(argv: string[], systemPrompt: string): AppConfig {
  const maxTokens = Number(process.env.AGENT_MAX_TOKENS ?? 2048);
  const maxIterations = Number(process.env.AGENT_MAX_ITERATIONS ?? 10);

  const llmProvider = (process.env.LLM_PROVIDER ?? "openai-compatible") as
    | "anthropic"
    | "openai-compatible";

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta una API key (GEMINI_API_KEY / LLM_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY). " +
        "Copia .env.example a .env y configura.",
    );
  }

  const llmConfig: LlmProviderConfig =
    llmProvider === "anthropic"
      ? {
          kind: "anthropic",
          apiKey,
          baseURL: process.env.LLM_BASE_URL || undefined,
          model: process.env.AGENT_MODEL ?? "claude-sonnet-4-5",
          maxTokens,
        }
      : {
          kind: "openai-compatible",
          baseURL: (process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, ""),
          apiKey,
          model: process.env.LLM_MODEL ?? "gemini-2.5-flash",
          maxTokens,
        };

  return {
    transportConfig: resolveTransportFromEnv(process.env, positionalUrl(argv)),
    llmConfig,
    policy: {
      model: llmConfig.model,
      maxTokens,
      // Presupuesto POR TURNO (por estímulo del usuario), no global.
      maxIterations,
      systemPrompt,
    },
  };
}

async function main(): Promise<void> {
  const systemPrompt = await resolveSystemPrompt();
  const config = loadConfig(process.argv, systemPrompt);

  const mcpClient = new McpClient({
    transport: createTransport(config.transportConfig),
    clientInfo: { name: "mcp-agent", version: "1.0.0" },
  });

  const llm = createLlmProvider(config.llmConfig);
  const channel = createChannel(process.env);
  const session = new AgentSession({ mcpClient, llm, policy: config.policy, channel });

  try {
    await mcpClient.connect();
    const server = mcpClient.getServerInfo();
    const where =
      config.transportConfig.kind === "stdio"
        ? config.transportConfig.command
        : config.transportConfig.url;
    console.log(`[mcp] Conectado (${config.transportConfig.kind}) a: ${where}`);
    if (server) {
      console.log(`[mcp] Servidor: ${server.name} v${server.version}`);
    }

    const tools = await mcpClient.listToolsForLLM();
    console.log(
      `[mcp] Herramientas descubiertas: ${tools.map((t) => t.name).join(", ") || "(ninguna)"}`,
    );

    console.log(`[llm] Proveedor: ${llm.id} | modelo: ${config.llmConfig.model}`);

    const result = await session.run();
    console.log(`\n[io] Sesión finalizada tras ${result.turns} turnos.`);
  } catch (error) {
    console.error(
      "[error] Falló la ejecución del agente:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await mcpClient.close();
    console.log("[mcp] Recursos liberados.");
  }
}

void main();