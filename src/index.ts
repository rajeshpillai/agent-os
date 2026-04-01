import { Agent } from "./agent/agent.js";
import { MockProvider, MockStep } from "./llm/providers/mock.provider.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";
import { ToolRegistry } from "./tools/registry.js";
import { createFinalizeTool } from "./tools/builtins/finalize.tool.js";
import { createListFilesTool } from "./tools/builtins/list-files.tool.js";
import { createReadFileTool } from "./tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "./tools/builtins/write-file.tool.js";

async function main() {
  const config = loadConfig();

  console.log("=== Agent OS v0.1.0 ===");
  console.log(`Provider: ${config.llmProvider}`);
  console.log(`Max steps: ${config.maxSteps}`);

  // Set up tool registry with all workspace tools
  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createListFilesTool("."));
  registry.register(createReadFileTool("."));
  registry.register(createWriteFileTool("."));

  console.log(`Tools: ${registry.list().map(t => t.name).join(", ")}`);

  // Demo: agent reads a file then finalizes
  const mockSteps: (string | MockStep)[] = [
    {
      content: "Let me read the README to understand this project.",
      toolCalls: [{ id: "call_1", name: "read_file", arguments: { path: "README.md" } }],
    },
    {
      content: "Got it. Let me summarize.",
      toolCalls: [
        {
          id: "call_2",
          name: "finalize",
          arguments: { result: "Agent OS is a Node.js + TypeScript runtime that turns an LLM into a controllable agent." },
        },
      ],
    },
  ];
  const provider = new MockProvider(mockSteps);

  const agent = new Agent(provider, {
    maxSteps: config.maxSteps,
    registry,
  });

  const task = createTask("Read the README and summarize this project.");
  const result = await agent.execute(task);

  console.log("\n=== Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.totalSteps}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Output:\n${result.output}`);
}

main().catch(console.error);
