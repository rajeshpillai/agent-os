import { Agent } from "./agent/agent.js";
import { MockProvider, MockStep } from "./llm/providers/mock.provider.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";

async function main() {
  const config = loadConfig();

  console.log("=== Agent OS v0.1.0 ===");
  console.log(`Provider: ${config.llmProvider}`);
  console.log(`Max steps: ${config.maxSteps}`);

  // Demo: mock provider with a tool-call step followed by a final answer
  const mockSteps: (string | MockStep)[] = [
    {
      content: "Let me look up the answer.",
      toolCalls: [
        { id: "call_1", name: "lookup", arguments: { query: "Agent OS" } },
      ],
    },
    "An Agent OS is a runtime that turns an LLM into a controllable agent with tools, memory, and safety boundaries.",
  ];
  const provider = new MockProvider(mockSteps);

  const agent = new Agent(provider, {
    maxSteps: config.maxSteps,
    // No real tool executor yet — uses default no-op
  });

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
