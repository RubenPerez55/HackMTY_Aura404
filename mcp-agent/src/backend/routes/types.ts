import type { BackendConfig } from "../config.js";
import type { BankDataSource } from "../../data/data-source.js";
import { EventBus } from "../events/bus.js";
import { McpRegistry } from "../mcp/registry.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { SessionManager } from "../orchestrator/session-manager.js";

export interface RouteDeps {
  config: BackendConfig;
  bus: EventBus;
  manager: SessionManager;
  orchestrator: Orchestrator;
  registry: McpRegistry;
  data: BankDataSource;
}