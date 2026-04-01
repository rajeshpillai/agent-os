import { Agent } from "./agent/agent.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";
import { createProvider } from "./llm/llm.js";
import { ToolRegistry } from "./tools/registry.js";
import { createFinalizeTool } from "./tools/builtins/finalize.tool.js";
import { createListFilesTool } from "./tools/builtins/list-files.tool.js";
import { createReadFileTool } from "./tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "./tools/builtins/write-file.tool.js";
import { createShellTool } from "./tools/builtins/shell.tool.js";
import { loadAllSkills, selectSkillsForTask } from "./skills/skill-loader.js";

async function main() {
  const config = loadConfig();

  console.log("=== Agent OS v0.1.0 ===");
  console.log(`Provider: ${config.llmProvider}`);
  console.log(`Max steps: ${config.maxSteps}`);

  // Set up tool registry
  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createListFilesTool("."));
  registry.register(createReadFileTool("."));
  registry.register(createWriteFileTool("."));
  registry.register(createShellTool({ workspaceRoot: "." }));
  console.log(`Tools: ${registry.list().map(t => t.name).join(", ")}`);

  // Load skills and select based on task
  const allSkills = loadAllSkills("./skills");
  console.log(`Skills loaded: ${allSkills.map(s => s.name).join(", ")}`);

  const task = createTask("Read the README.md file and give me a 2-sentence summary of this project.");
  const selectedSkills = selectSkillsForTask(allSkills, task.description);
  console.log(`Skills selected: ${selectedSkills.map(s => s.name).join(", ") || "(none)"}`);

  // Create provider from config — passes tool definitions for OpenAI function calling
  const provider = createProvider(config, {
    tools: registry.list(),
  });

  const agent = new Agent(provider, {
    maxSteps: config.maxSteps,
    registry,
    skills: selectedSkills,
  });

  const result = await agent.execute(task);

  console.log("\n=== Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Steps: ${result.totalSteps}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Output:\n${result.output}`);
}

main().catch(console.error);
