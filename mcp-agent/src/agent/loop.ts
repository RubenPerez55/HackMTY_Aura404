import type { AgentHarness } from "./harness.js";
import type { LlmProvider } from "../llm/provider.js";
import type { LlmToolResultBlock, LlmToolUseBlock } from "../llm/types.js";
import { textFromBlocks } from "../llm/types.js";
import type { AgentMcpClient, ToolExecutionResult } from "../mcp/types.js";

export interface AgentLoopOptions {
  mcpClient: AgentMcpClient;
  harness: AgentHarness;
  llm: LlmProvider;
  /** Hook opcional invocado antes de ejecutar cada tool (para status/telemetría). */
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
  /** Hook opcional invocado tras ejecutar cada tool (para telemetría de resultados). */
  onToolResult?: (name: string, input: Record<string, unknown>, result: ToolExecutionResult) => void;
}

export interface AgentRunResult {
  /** Respuesta final del agente, si se obtuvo. */
  finalAnswer: string | null;
  /** Número total de iteraciones consumidas. */
  iterations: number;
  /** `true` si se detuvo por agotar el límite de iteraciones. */
  stoppedDueToLimit: boolean;
}

/**
 * Bucle agente LLM <-> MCP.
 *
 * Flujo por iteración:
 *  1. Enviar prompt + historial + herramientas MCP al LLM.
 *  2. Inspeccionar los `tool_use` de la respuesta:
 *       - sin tool_use  -> respuesta final, terminamos.
 *       - con tool_use  -> ejecutar cada herramienta vía MCP e
 *                          inyectar los `tool_result` en el historial.
 *  3. Repetir mientras haya iteraciones disponibles.
 *
 * El loop solo conoce la interfaz `LlmProvider`; la traducción al formato
 * nativo de cada proveedor queda encapsulada en el provider.
 */
export class AgentLoop {
  constructor(private readonly options: AgentLoopOptions) {}

  async run(): Promise<AgentRunResult> {
    const { mcpClient, harness, llm } = this.options;

    while (true) {
      harness.assertRemainingIterations();
      harness.advance();

      const tools = await mcpClient.listToolsForLLM();
      const turn = await llm.complete(
        [...harness.history],
        tools,
        harness.policy.systemPrompt,
      );

      // Registramos la respuesta del asistente con sus tool_use para que
      // el LLM vea la continuidad de la conversación en el siguiente ciclo.
      harness.append({ role: "assistant", content: turn.content });

      if (turn.toolUses.length === 0) {
        return {
          finalAnswer: textFromBlocks(turn.content),
          iterations: harness.iterationCount,
          stoppedDueToLimit: false,
        };
      }

      const toolResults = await this.executeToolUses(mcpClient, turn.toolUses);
      harness.append({ role: "user", content: toolResults });

      if (harness.isExhausted) {
        return {
          finalAnswer: null,
          iterations: harness.iterationCount,
          stoppedDueToLimit: true,
        };
      }
    }
  }

  /**
   * Ejecuta todas las herramientas solicitadas por el modelo.
   * Las lanza en paralelo; cada resultado fallido se marca como `is_error`
   * para que el modelo pueda autocorregirse en la siguiente iteración.
   */
  private async executeToolUses(
    mcpClient: AgentMcpClient,
    toolUses: LlmToolUseBlock[],
  ): Promise<LlmToolResultBlock[]> {
    return Promise.all(
      toolUses.map(async (block): Promise<LlmToolResultBlock> => {
        this.options.onToolUse?.(block.name, block.input);
        try {
          const result = await mcpClient.callTool(block.name, block.input);
          this.options.onToolResult?.(block.name, block.input, result);
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: result.content,
            is_error: result.isError,
          };
        } catch (error) {
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error al ejecutar la herramienta "${block.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            is_error: true,
          };
        }
      }),
    );
  }
}