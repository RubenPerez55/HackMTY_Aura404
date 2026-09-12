import Anthropic from "@anthropic-ai/sdk";

import type { LlmProviderConfig, LlmProvider } from "./provider.js";
import type { LlmContentBlock, LlmMessage, LlmTool, LlmToolUseBlock, LlmTurn } from "./types.js";

/**
 * Proveedor Anthropic (Claude directo o la API /messages compatible de
 * OpenRouter). El formato neutral ya es "anthropic-style", por lo que el
 * mapeo es prácticamente un passthrough.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly id = "anthropic";

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: Extract<LlmProviderConfig, { kind: "anthropic" }>) {
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? undefined,
      defaultHeaders: config.headers,
    });
  }

  async complete(
    history: readonly LlmMessage[],
    tools: readonly LlmTool[],
    system: string,
  ): Promise<LlmTurn> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      // El formato neutro coincide con el nativo de Anthropic.
      messages: history as unknown as Anthropic.Messages.MessageParam[],
      tools: tools as unknown as Anthropic.Messages.Tool[],
    });

    return {
      content: response.content.map((block): LlmContentBlock => {
        if (block.type === "tool_use") {
          const use: LlmToolUseBlock = {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
          return use;
        }
        return { type: "text", text: (block as Anthropic.Messages.TextBlock).text };
      }),
      toolUses: response.content
        .filter((block) => block.type === "tool_use")
        .map((block) => ({
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        })),
    };
  }
}