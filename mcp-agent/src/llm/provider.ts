import { AnthropicLlmProvider } from "./anthropic.provider.js";
import { OpenAICompatibleLlmProvider } from "./openai-compatible.provider.js";
import type { LlmMessage, LlmTool, LlmTurn } from "./types.js";

/**
 * Interfaz de proveedor LLM: el agent loop solo conoce este contrato.
 * La traducción al formato nativo de cada proveedor queda encapsulada
 * en las implementaciones.
 */
export interface LlmProvider {
  /** Identificador legible del proveedor (para logs). */
  readonly id: string;
  /**
   * Pide una respuesta al modelo dado el historial y las herramientas.
   * Devuelve el turno del asistente (texto y/o llamadas a herramientas).
   */
  complete(
    history: readonly LlmMessage[],
    tools: readonly LlmTool[],
    system: string,
  ): Promise<LlmTurn>;
}

/**
 * Configuración de un proveedor. `kind` discrimina la implementación.
 */
export type LlmProviderConfig =
  | {
      kind: "anthropic";
      apiKey: string;
      /** URL base. Usar https://openrouter.ai/api/v1 permite Anthropic vía OpenRouter. */
      baseURL?: string;
      headers?: Record<string, string>;
      model: string;
      maxTokens: number;
    }
  | {
      kind: "openai-compatible";
      baseURL: string;
      apiKey: string;
      model: string;
      maxTokens: number;
    };

/**
 * Factory: instancia el proveedor LLM según la configuración.
 */
export function createLlmProvider(config: LlmProviderConfig): LlmProvider {
  switch (config.kind) {
    case "anthropic":
      return new AnthropicLlmProvider(config);
    case "openai-compatible":
      return new OpenAICompatibleLlmProvider(config);
    default:
      return config satisfies never;
  }
}