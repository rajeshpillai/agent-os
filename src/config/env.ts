export interface Config {
  llmProvider: string;
  maxSteps: number;
  workspaceRoot: string;
}

export function loadConfig(): Config {
  return {
    llmProvider: process.env.LLM_PROVIDER ?? "mock",
    maxSteps: parseInt(process.env.AGENT_MAX_STEPS ?? "10", 10),
    workspaceRoot: process.env.WORKSPACE_ROOT ?? "./workspace",
  };
}
