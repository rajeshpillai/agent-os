import { LLMProvider } from "../core/types.js";
import { ToolDefinition } from "../tools/tool.js";
import { Config } from "../config/env.js";
import { MockProvider } from "./providers/mock.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";

export interface LLMProviderOptions {
  tools?: ToolDefinition[];
}

const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function createProvider(config: Config, options?: LLMProviderOptions): LLMProvider {
  switch (config.llmProvider) {
    case "openai": {
      if (!config.openaiApiKey) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      }
      return new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: config.openaiModel,
        tools: options?.tools,
      });
    }
    case "gemini": {
      if (!config.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      }
      return new OpenAIProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        baseURL: GEMINI_OPENAI_BASE_URL,
        tools: options?.tools,
      });
    }
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
