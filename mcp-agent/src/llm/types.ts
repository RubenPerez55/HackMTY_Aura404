/**
 * Tipos neutrales de mensajería LLM.
 *
 * Son independientes de cualquier proveedor (Anthropic, OpenAI, OpenRouter,
 * Ollama...). Se basan en el modelo "anthropic-style" porque es el más
 * natural para agent loops: el asistente emite bloques (texto + tool_use) y
 * el usuario vuelve con los resultados (tool_result).
 */

export type LlmTextBlock = {
  type: "text";
  text: string;
};

export type LlmToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  extra_content?: unknown;
};

export type LlmToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock;

export interface LlmMessage {
  role: "user" | "assistant";
  content: LlmContentBlock[];
}

/**
 * Definición de herramienta expuesta a un LLM.
 * `input_schema` incluye `type: "object"` obligatorio:
 * Anthropic lo exige literalmente; OpenAI lo acepta como `parameters`.
 */
export interface LlmTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: unknown; [key: string]: unknown };
}

/**
 * Resultado de una llamada al LLM: el contenido del asistente (texto y/o
 * tool_use) junto con los tool_use extraídos para el bucle del agente.
 */
export interface LlmTurn {
  content: LlmContentBlock[];
  toolUses: LlmToolUseBlock[];
}

/** Extrae el texto concatenado de un contenido (respuestas finales). */
export function textFromBlocks(content: readonly LlmContentBlock[]): string {
  return content
    .filter((block): block is LlmTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}