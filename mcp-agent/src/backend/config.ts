import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { AgentPolicy } from "../agent/harness.js";
import { createLlmProvider, type LlmProvider, type LlmProviderConfig } from "../llm/provider.js";
import type { McpTransportConfig } from "../mcp/transport.js";
import type { McpServerConfig } from "./mcp/registry.js";

/**
 * Configuración completa del BFF / orquestador, derivada del entorno.
 * Reutiliza las mismas variables LLM del agente y añade el registro
 * multi-server MCP con el patrón `MCP_<SERVER_ID>_URL|TOKEN|TRANSPORT`.
 */
export interface BackendConfig {
  host: string;
  port: number;
  /** Ruta opcional de snapshot JSON para persistir sesiones. */
  storeFile?: string;
  /** Carpeta de la base CSV compartida (usuarios/tarjetas/transacciones). */
  dataDir?: string;
  llm: LlmProvider;
  policy: AgentPolicy;
  mcpServers: McpServerConfig[];
}

/** Igual de `index.ts`: llama a `AGENT_SYSTEM_PROMPT > AGENT_TASK_FILE > ./task.md`. */
export async function resolveSystemPrompt(env: NodeJS.ProcessEnv): Promise<string> {
  if (env.AGENT_SYSTEM_PROMPT) return env.AGENT_SYSTEM_PROMPT;

  const candidates = env.AGENT_TASK_FILE ? [env.AGENT_TASK_FILE] : ["./task.md"];
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

export function resolveLlm(env: NodeJS.ProcessEnv): { llm: LlmProvider; config: LlmProviderConfig } {
  const apiKey = env.LLM_API_KEY ?? env.OPENROUTER_API_KEY ?? env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta una API key (LLM_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY) para el backend.",
    );
  }

  const maxTokens = Number(env.AGENT_MAX_TOKENS ?? 2048);
  const provider = (env.LLM_PROVIDER ?? "openai-compatible") as "anthropic" | "openai-compatible";

  const config: LlmProviderConfig =
    provider === "anthropic"
      ? {
          kind: "anthropic",
          apiKey,
          baseURL: env.LLM_BASE_URL || undefined,
          model: env.AGENT_MODEL ?? "claude-sonnet-4-5",
          maxTokens,
        }
      : {
          kind: "openai-compatible",
          baseURL: (env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, ""),
          apiKey,
          model: env.LLM_MODEL ?? "openai/gpt-4o-mini",
          maxTokens,
        };

  return { llm: createLlmProvider(config), config };
}

/**
 * Registro multi-server MCP desde el entorno. Soporta dos formas de
 * declarar un server, por `<SERVER_ID>`:
 *
 *  - Remoto HTTP: `MCP_<SERVER_ID>_URL` (+ `_TOKEN`, `_TRANSPORT` opcionales;
 *    auto = `streamable-http`, o `sse`). Ej.: `MCP_BANKING_URL=https://.../mcp`.
 *  - Local stdio: `MCP_<SERVER_ID>_COMMAND` (+ `_ARGS` como JSON array).
 *    Ej.: `MCP_UI_COMMAND=tsx`, `MCP_UI_ARGS=["src/mcp-servers/ui-server.ts"]`.
 *    Pensado para servers que no necesitan desplegarse aparte (como el
 *    server `ui`/A2UI: no toca datos externos, solo arma JSON).
 *
 * Si un `<SERVER_ID>` define ambas, gana `_URL` (remoto).
 */
export function resolveMcpServersFromEnv(env: NodeJS.ProcessEnv): McpServerConfig[] {
  type Group = {
    url?: string;
    token?: string;
    transport?: string;
    command?: string;
    args?: string;
  };
  const groups = new Map<string, Group>();

  for (const [key, value] of Object.entries(env)) {
    const match = /^MCP_([A-Z0-9_]+)_(URL|TOKEN|TRANSPORT|COMMAND|ARGS)$/.exec(key);
    if (!match) continue;
    const id = match[1].toLowerCase().replace(/_/g, "-");
    const field = match[2].toLowerCase() as "url" | "token" | "transport" | "command" | "args";
    const group = groups.get(id) ?? {};
    group[field] = value;
    groups.set(id, group);
  }

  const servers: McpServerConfig[] = [];
  for (const [id, group] of groups) {
    if (group.url) {
      servers.push({ id, transport: httpTransport(group.url, group.transport, group.token) });
    } else if (group.command) {
      servers.push({ id, transport: stdioTransport(group.command, group.args) });
    }
  }

  // Fallback por defecto: si no hay servidor bancario remoto configurado,
  // conecta automáticamente al servidor MCP bancario local sobre stdio.
  if (servers.length === 0) {
    const serverScript = fileURLToPath(new URL("../mcp-server/banking-server.ts", import.meta.url));
    servers.push({
      id: "banking",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["tsx", serverScript],
      },
    });
  }

  return servers;
}

function httpTransport(
  url: string,
  transport?: string,
  token?: string,
): McpTransportConfig {
  const urlClean = url.trim();
  const kind =
    transport === "sse" || transport === "http-sse" || urlClean.endsWith("/sse")
      ? "sse"
      : "streamable-http";
  return { kind, url: urlClean, token: token || undefined };
}

function stdioTransport(command: string, argsRaw?: string): McpTransportConfig {
  let args: string[] | undefined;
  if (argsRaw) {
    try {
      const parsed = JSON.parse(argsRaw);
      args = Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
      args = argsRaw.split(/\s+/).filter(Boolean);
    }
  }
  return { kind: "stdio", command: command.trim(), args };
}

export async function loadBackendConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BackendConfig> {
  const systemPrompt = await resolveSystemPrompt(env);
  const { llm, config: llmConfig } = resolveLlm(env);

  const maxIterations = Number(env.AGENT_MAX_ITERATIONS ?? 10);
  const policy: AgentPolicy = {
    model: llmConfig.model,
    maxTokens: llmConfig.maxTokens,
    maxIterations,
    systemPrompt,
  };

  return {
    host: env.BFF_HOST ?? "0.0.0.0",
    port: Number(env.BFF_PORT ?? 4000),
    storeFile: env.BFF_STORE_FILE || undefined,
    dataDir: env.DATA_DIR || undefined,
    llm,
    policy,
    mcpServers: resolveMcpServersFromEnv(env),
  };
}