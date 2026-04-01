import { Agent } from "./agent/agent.js";
import { MockProvider } from "./llm/providers/mock.provider.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";

async function main() {
  const config = loadConfig();

  console.log("=== Agent OS v0.1.0 ===");
  console.log(`Provider: ${config.llmProvider}`);
  console.log(`Max steps: ${config.maxSteps}`);

  const provider = new MockProvider();
  const agent = new Agent(provider, { maxSteps: config.maxSteps });

  const task = createTask(
    "Explain what an Agent OS is and why it matters for AI engineering."
  );

  const result = await agent.execute(task);

  console.log("\n=== Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.totalSteps}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Output:\n${result.output}`);
}

main().catch(console.error);
