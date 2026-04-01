import OpenAI from "openai";
import { LLMProvider, LLMResponse, Message, ToolCall } from "../../core/types.js";
import { ToolDefinition, ToolParameter } from "../../tools/tool.js";

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  tools?: ToolDefinition[];
  baseURL?: string;
}

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool;

function paramTypeToJsonSchema(type: ToolParameter["type"]): string {
  return type; // string, number, boolean, object map directly
}

function toolDefsToOpenAI(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map(tool => {
    const properties: Record<string, object> = {};
    const required: string[] = [];

    for (const param of tool.parameters) {
      properties[param.name] = {
        type: paramTypeToJsonSchema(param.type),
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        },
      },
    };
  });
}

function toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content: msg.content,
        tool_call_id: msg.toolCallId!,
      };
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }

    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

function fromOpenAIToolCalls(
  toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
): ToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;

  return toolCalls
    .filter(tc => tc.type === "function")
    .map(tc => {
      const fn = tc as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
        type: "function";
        function: { name: string; arguments: string };
      };
      return {
        id: fn.id,
        name: fn.function.name,
        arguments: JSON.parse(fn.function.arguments),
      };
    });
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private openaiTools?: OpenAITool[];

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.openaiTools = config.tools?.length ? toolDefsToOpenAI(config.tools) : undefined;
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(messages),
      tools: this.openaiTools,
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    const toolCalls = fromOpenAIToolCalls(assistantMsg.tool_calls);

    let stopReason: LLMResponse["stopReason"];
    if (choice.finish_reason === "tool_calls") {
      stopReason = "tool_use";
    } else if (choice.finish_reason === "length") {
      stopReason = "max_tokens";
    } else {
      stopReason = "end_turn";
    }

    // If there are tool calls, treat as tool_use regardless of finish_reason
    if (toolCalls?.length) {
      stopReason = "tool_use";
    }

    return {
      message: {
        role: "assistant",
        content: assistantMsg.content ?? "",
        toolCalls,
      },
      stopReason,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
