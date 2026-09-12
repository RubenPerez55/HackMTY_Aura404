import type { LlmProviderConfig, LlmProvider } from "./provider.js";
import type {
  LlmContentBlock,
  LlmMessage,
  LlmTool,
  LlmToolResultBlock,
  LlmToolUseBlock,
  LlmTurn,
} from "./types.js";

/** Mensaje en el formato nativo de `/v1/chat/completions`. */
type OpenAICompatibleMessage =
  | { role: "system" | "user" | "assistant"; content: string | null }
  | { role: "assistant"; content: string | null; tool_calls: OpenAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  extra_content?: unknown;
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

/**
 * Proveedor "compatible con OpenAI" usando `fetch` nativo (sin SDK extra).
 *
 * Cubre Gemini, OpenRouter, Ollama, LM Studio, vLLM, llama.cpp, Groq, Together, etc.
 * Traduce el formato neutral (anthropic-style) al formato de
 * `chat/completions`:
 *   - texto            -> content
 *   - tool_use         -> tool_calls en la respuesta del assistant
 *   - tool_result      -> mensajes con role: "tool" + tool_call_id
 */
export class OpenAICompatibleLlmProvider implements LlmProvider {
  readonly id = "openai-compatible";

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: Extract<LlmProviderConfig, { kind: "openai-compatible" }>) {
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async complete(
    history: readonly LlmMessage[],
    tools: readonly LlmTool[],
    system: string,
  ): Promise<LlmTurn> {
    const messages: OpenAICompatibleMessage[] = [
      { role: "system", content: system },
      ...this.toOpenAIMessages(history),
    ];

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      tools: tools.map((tool) => this.toOpenAITool(tool)),
    };

    const response = await fetch(`${this.baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `El LLM respondió ${response.status}: ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    return this.parseTurn((data as OpenAICompatibleResponse) ?? null);
  }

  /* ------------------------------------------------------------------ */
  /*  Neutral -> OpenAI                                                  */
  /* ------------------------------------------------------------------ */
  private toOpenAIMessages(history: readonly LlmMessage[]): OpenAICompatibleMessage[] {
    const out: OpenAICompatibleMessage[] = [];

    for (const message of history) {
      const textParts: string[] = [];
      const toolUses: LlmToolUseBlock[] = [];
      const toolResults: LlmToolResultBlock[] = [];

      for (const block of message.content) {
        switch (block.type) {
          case "text":
            textParts.push(block.text);
            break;
          case "tool_use":
            toolUses.push(block);
            break;
          case "tool_result":
            toolResults.push(block);
            break;
        }
      }

      if (message.role === "assistant") {
        if (toolUses.length > 0) {
          out.push({
            role: "assistant",
            content: textParts.join("\n") || null,
            tool_calls: toolUses.map((block) => ({
              id: block.id,
              type: "function",
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
              ...(block.extra_content ? { extra_content: block.extra_content } : {}),
            })),
          });
        } else if (textParts.length > 0) {
          out.push({ role: "assistant", content: textParts.join("\n") });
        }
      } else {
        if (textParts.length > 0) {
          out.push({ role: "user", content: textParts.join("\n") });
        }
        for (const result of toolResults) {
          out.push({
            role: "tool",
            tool_call_id: result.tool_use_id,
            content: result.is_error ? `Error: ${result.content}` : result.content,
          });
        }
      }
    }
    return out;
  }

  private toOpenAITool(tool: LlmTool): {
    type: "function";
    function: { name: string; description?: string; parameters: unknown };
  } {
    // `$schema` y otros metadatos de JSON Schema pueden romper validaciones
    // estrictas de algunos proveedores; los descartamos del input.
    const { $schema: _omit, ...parameters } = tool.input_schema;
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || undefined,
        parameters,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /*  OpenAI -> Neutral                                                  */
  /* ------------------------------------------------------------------ */
  private parseTurn(data: OpenAICompatibleResponse | null): LlmTurn {
    const message = data?.choices?.[0]?.message;
    if (!data || !message) {
      throw new Error("Respuesta del LLM sin choices: " + JSON.stringify(data));
    }

    const content: LlmContentBlock[] = [];
    const toolUses: LlmToolUseBlock[] = [];

    if (typeof message.content === "string" && message.content.length > 0) {
      content.push({ type: "text", text: message.content });
    }

    for (const call of message.tool_calls ?? []) {
      let input: Record<string, unknown> = {};
      try {
        input = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        // Arguments corruptos no deben tumbar el bucle; se reenviarán vacíos
        // y el modelo podrá autocorregirse.
        input = {};
      }
      const use: LlmToolUseBlock = {
        type: "tool_use",
        id: call.id,
        name: call.function?.name ?? "",
        input,
        extra_content: call.extra_content,
      };
      toolUses.push(use);
      content.push(use);
    }

    return { content, toolUses };
  }
}