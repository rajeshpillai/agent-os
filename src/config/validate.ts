import { Config } from "./env.js";
import { AgentError } from "../core/errors.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];

  if (!config.llmProvider) {
    errors.push("LLM_PROVIDER is required");
  } else if (!["mock", "openai", "gemini", "ollama"].includes(config.llmProvider)) {
    errors.push(`Unknown LLM_PROVIDER: "${config.llmProvider}". Supported: mock, openai, gemini, ollama`);
  }

  if (config.llmProvider === "openai" && !config.openaiApiKey) {
    errors.push("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
  }

  if (config.llmProvider === "gemini" && !config.geminiApiKey) {
    errors.push("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
  }

  if (config.maxSteps < 1 || config.maxSteps > 100) {
    errors.push(`AGENT_MAX_STEPS must be between 1 and 100, got ${config.maxSteps}`);
  }

  if (isNaN(config.maxSteps)) {
    errors.push("AGENT_MAX_STEPS must be a valid number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertConfigValid(config: Config): void {
  const result = validateConfig(config);
  if (!result.valid) {
    throw new AgentError(
      `Invalid configuration:\n${result.errors.map(e => `  - ${e}`).join("\n")}`,
      "config_error"
    );
  }
}
