import { Agent } from "./agent/agent.js";
import { MockProvider, MockStep } from "./llm/providers/mock.provider.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";
import { ToolRegistry } from "./tools/registry.js";
import { createFinalizeTool } from "./tools/builtins/finalize.tool.js";
import { createListFilesTool } from "./tools/builtins/list-files.tool.js";

async function main() {
  const config = loadConfig();

  console.log("=== Agent OS v0.1.0 ===");
  console.log(`Provider: ${config.llmProvider}`);
  console.log(`Max steps: ${config.maxSteps}`);

  // Set up tool registry
  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createListFilesTool(config.workspaceRoot));

  console.log(`Tools: ${registry.list().map(t => t.name).join(", ")}`);

  // Demo: agent lists files then finalizes
  const mockSteps: (string | MockStep)[] = [
    {
      content: "Let me list the workspace files first.",
      toolCalls: [{ id: "call_1", name: "list_files", arguments: { path: "." } }],
    },
    {
      content: "Now I have the file listing. Let me finalize.",
      toolCalls: [
        {
          id: "call_2",
          name: "finalize",
          arguments: { result: "Workspace contains the Agent OS source files." },
        },
      ],
    },
  ];
  const provider = new MockProvider(mockSteps);

  const agent = new Agent(provider, {
    maxSteps: config.maxSteps,
    registry,
  });

  const task = createTask("List the files in the workspace and describe what you see.");

  const result = await agent.execute(task);

  console.log("\n=== Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.totalSteps}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Output:\n${result.output}`);
}

main().catch(console.error);
