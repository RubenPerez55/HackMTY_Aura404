import type { LlmTool } from "../llm/types.js";

/**
 * Resultado normalizado de una ejecución de herramienta MCP.
 */
export interface ToolExecutionResult {
  content: string;
  isError: boolean;
}

/**
 * Contrato mínimo que el agent loop necesita de un cliente MCP.
 *
 * `McpClient` ya lo satisface estructuralmente; el orquestador puede
 * pasar un compuesto (varios servidores agregados) sin tocar el agente.
 */
export interface AgentMcpClient {
  /** Descubre y normaliza las herramientas disponibles para el LLM. */
  listToolsForLLM(): Promise<LlmTool[]>;
  /** Ejecuta una herramienta en el(los) servidor(es) subyacente(s). */
  callTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
}