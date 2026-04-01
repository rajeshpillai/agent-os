import { config } from "dotenv";

// Load .env file
config();

export interface Config {
  llmProvider: string;
  openaiApiKey?: string;
  openaiModel: string;
  geminiApiKey?: string;
  geminiModel: string;
  maxSteps: number;
  workspaceRoot: string;
}

export function loadConfig(): Config {
  return {
    llmProvider: process.env.LLM_PROVIDER ?? "mock",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    maxSteps: parseInt(process.env.AGENT_MAX_STEPS ?? "10", 10),
    workspaceRoot: process.env.WORKSPACE_ROOT ?? "./workspace",
  };
}
