import { ParsedArgs } from "../parse-args.js";
import { loadConfig } from "../../config/env.js";
import { assertConfigValid } from "../../config/validate.js";
import { createProvider } from "../../llm/llm.js";
import { Agent } from "../../agent/agent.js";
import { createTask } from "../../core/task.js";
import { ToolRegistry } from "../../tools/registry.js";
import { createFinalizeTool } from "../../tools/builtins/finalize.tool.js";
import { createListFilesTool } from "../../tools/builtins/list-files.tool.js";
import { createReadFileTool } from "../../tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "../../tools/builtins/write-file.tool.js";
import { createShellTool } from "../../tools/builtins/shell.tool.js";
import { loadAllSkills, selectSkillsForTask } from "../../skills/skill-loader.js";
import { FileMemoryStore } from "../../memory/file-memory-store.js";
import { EventBus } from "../../runtime/event-bus.js";
import { RunLogger } from "../../runtime/run-logger.js";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { scanProject, formatProjectTree } from "../../storage/project-scanner.js";

function slugifyTask(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")  // non-alphanumeric → hyphens
    .replace(/^-+|-+$/g, "")       // trim leading/trailing hyphens
    .slice(0, 50)                   // cap length
    .replace(/-+$/, "");            // trim trailing hyphen after slice
}

export async function runTaskCommand(args: ParsedArgs): Promise<void> {
  if (!args.task) {
    console.error('Error: task description required. Usage: agent-os run "your task"');
    process.exit(1);
  }

  // Load config from .env, override with CLI flags
  const config = loadConfig();

  if (args.flags.provider) {
    config.llmProvider = args.flags.provider as string;
  }
  if (args.flags["max-steps"]) {
    config.maxSteps = parseInt(args.flags["max-steps"] as string, 10);
  }
  if (args.flags.model) {
    const model = args.flags.model as string;
    if (config.llmProvider === "openai") config.openaiModel = model;
    else if (config.llmProvider === "gemini") config.geminiModel = model;
    else if (config.llmProvider === "ollama") config.ollamaModel = model;
  }

  assertConfigValid(config);

  const workspaceBase = resolve((args.flags.workspace as string) ?? config.workspaceRoot);
  const isExistingProject = !!args.flags.project;
  let workspace: string;
  let projectTree: string | undefined;

  if (isExistingProject) {
    // --project targets an existing project folder
    const projectName = args.flags.project as string;
    workspace = resolve(workspaceBase, projectName);

    if (!existsSync(workspace)) {
      console.error(`Error: project "${projectName}" not found at ${workspace}`);
      console.error(`Available projects:`);
      try {
        const { readdirSync, statSync } = await import("node:fs");
        const entries = readdirSync(workspaceBase)
          .filter(e => statSync(resolve(workspaceBase, e)).isDirectory());
        entries.forEach(e => console.error(`  - ${e}`));
        if (entries.length === 0) console.error("  (none)");
      } catch {
        console.error("  (workspace directory does not exist)");
      }
      process.exit(1);
    }

    // Scan existing project structure
    const files = scanProject(workspace);
    projectTree = formatProjectTree(files);
    console.log(`[Agent] Existing project: ${workspace} (${files.length} files)`);
  } else {
    // New project — auto-generate or use --name
    const projectName = (args.flags.name as string) ?? slugifyTask(args.task);
    workspace = resolve(workspaceBase, projectName);
    mkdirSync(workspace, { recursive: true });
    console.log(`[Agent] Project directory: ${workspace}`);
  }

  const skillsDir = resolve((args.flags["skills-dir"] as string) ?? "./skills");
  const logsDir = resolve((args.flags["logs-dir"] as string) ?? "./.agent-os/logs");
  const verbose = args.flags.verbose === true;

  // Set up tool registry
  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createListFilesTool(workspace));
  registry.register(createReadFileTool(workspace));
  registry.register(createWriteFileTool(workspace));
  registry.register(createShellTool({ workspaceRoot: workspace }));

  if (verbose) {
    console.log(`Provider: ${config.llmProvider}`);
    console.log(`Workspace: ${workspace}`);
    console.log(`Max steps: ${config.maxSteps}`);
    console.log(`Tools: ${registry.list().map(t => t.name).join(", ")}`);
  }

  // Load and select skills
  const allSkills = loadAllSkills(skillsDir);
  const task = createTask(args.task);
  const selectedSkills = selectSkillsForTask(allSkills, task.description);

  if (verbose && allSkills.length > 0) {
    console.log(`Skills loaded: ${allSkills.map(s => s.name).join(", ")}`);
    console.log(`Skills selected: ${selectedSkills.map(s => s.name).join(", ") || "(none)"}`);
  }

  // Set up event bus and logger
  const eventBus = new EventBus();
  mkdirSync(logsDir, { recursive: true });
  const runLogger = new RunLogger({ logsDir });

  // Set up memory
  const memoryDir = resolve("./.agent-os/memory");
  const memoryStore = new FileMemoryStore(memoryDir);

  // Create provider
  const provider = createProvider(config, { tools: registry.list() });

  // Create and run agent
  const agent = new Agent(provider, {
    maxSteps: config.maxSteps,
    registry,
    skills: selectedSkills,
    memoryStore,
    eventBus,
    runLogger,
    projectTree,
  });

  const result = await agent.execute(task);

  // Output
  console.log(`\n${"─".repeat(60)}`);
  if (result.success) {
    console.log(`\n${result.output}\n`);
  } else {
    console.error(`\nFailed: ${result.output}\n`);
  }
  console.log(`${"─".repeat(60)}`);
  console.log(`Steps: ${result.totalSteps} | Duration: ${result.duration}ms | Run: ${result.runId}`);

  if (!result.success) {
    process.exit(1);
  }
}
