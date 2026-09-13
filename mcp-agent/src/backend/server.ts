import "dotenv/config";

import { pathToFileURL } from "node:url";

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import type { AgentPolicy } from "../agent/harness.js";
import type { LlmProvider } from "../llm/provider.js";
import { loadBackendConfig } from "./config.js";
import { BankDataSource } from "../data/data-source.js";
import { EventBus } from "./events/bus.js";
import { McpRegistry, type McpServerConfig } from "./mcp/registry.js";
import { CompositeMcpClient } from "./mcp/composite.js";
import { SessionManager } from "./orchestrator/session-manager.js";
import { TurnRunner } from "./orchestrator/turn-runner.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { MemorySessionStore } from "./storage/store.js";
import { registerEvents } from "./routes/events.js";
import { registerMessages } from "./routes/messages.js";
import { registerSessions } from "./routes/sessions.js";
import { registerTools } from "./routes/tools.js";
import { registerTriggers } from "./routes/triggers.js";
import { registerDataRoutes } from "./routes/data.js";
import type { RouteDeps } from "./routes/types.js";

/** Overrides para tests/demos: permite inyectar fakes sin tocar entorno. */
export interface BuildServerOverrides {
  llm?: LlmProvider;
  policy?: AgentPolicy;
  mcpServers?: McpServerConfig[];
  host?: string;
  port?: number;
  storeFile?: string;
  /** Carpeta de la base CSV compartida (default: `../data` junto al motor). */
  dataDir?: string;
}

/**
 * BFF / Orquestador: expone el agente MCP como API REST + SSE.
 *
 * Boot:
 *  1. Carga config (LLM + policy + servers MCP desde env).
 *  2. Conecta los servers MCP (banking, motor de impacto...).
 *  3. Compone agent harness/loop por-turno detrás de una fachada REST.
 */
export async function buildServer(
  overrides: BuildServerOverrides = {},
): Promise<{
  app: FastifyInstance;
  deps: RouteDeps;
  store: MemorySessionStore;
}> {
  const env = process.env;
  const needsEnvConfig = !overrides.llm && !overrides.policy;
  const base = needsEnvConfig ? await loadBackendConfig() : null;

  const llm = overrides.llm ?? (base?.llm as LlmProvider);
  const policy = overrides.policy ?? (base?.policy as AgentPolicy);
  const host = overrides.host ?? base?.host ?? env.BFF_HOST ?? "0.0.0.0";
  const port = overrides.port ?? base?.port ?? Number(env.PORT ?? env.BFF_PORT ?? 4000);
  const storeFile = overrides.storeFile ?? base?.storeFile;
  const mcpServers = overrides.mcpServers ?? base?.mcpServers ?? [];
  const dataDir = overrides.dataDir ?? base?.dataDir;

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const bus = new EventBus();
  const store = new MemorySessionStore(storeFile);
  await store.load();
  const manager = new SessionManager(store);

  const registry = new McpRegistry();
  for (const server of mcpServers) registry.register(server);
  await registry.connectAll();
  if (registry.connectedIds().length === 0) {
    app.log.warn("Ningún server MCP configurado/unido. El agente operará sin tools.");
  }

  const composite = new CompositeMcpClient(registry.entries());
  const runner = new TurnRunner({
    bus,
    manager,
    llm,
    policy,
    mcpClient: composite,
  });
  const orchestrator = new Orchestrator({ bus, manager, runner });

  const dataSource = new BankDataSource(dataDir);

  const config = {
    host,
    port,
    storeFile,
    dataDir: dataSource.dirPath,
    llm,
    policy,
    mcpServers,
  };
  const deps: RouteDeps = { config, bus, manager, orchestrator, registry, data: dataSource };

  app.get("/api/health", async () => ({
    status: "ok",
    mcpServers: registry.connectedIds(),
    sessions: manager.list().length,
  }));

  registerSessions(app, deps);
  registerMessages(app, deps);
  registerEvents(app, deps);
  registerTools(app, deps);
  registerTriggers(app, deps);
  registerDataRoutes(app, deps);

  return { app, deps, store };
}

async function main(): Promise<void> {
  const { app, deps, store } = await buildServer();
  const { config } = deps;

  const shutdown = async (signal: string) => {
    app.log.info(`Recibido ${signal}, cerrando servidor…`);
    await deps.registry.closeAll();
    await store.flush();
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`BFF orquestador listo en http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    await deps.registry.closeAll();
    await store.flush();
    await app.close();
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) void main();