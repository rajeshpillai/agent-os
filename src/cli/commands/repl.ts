import { createInterface } from "node:readline";
import { resolve, basename } from "node:path";
import { mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { loadConfig, Config } from "../../config/env.js";
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
import { scanProject, formatProjectTree } from "../../storage/project-scanner.js";
import { ParsedArgs } from "../parse-args.js";

interface ReplState {
  config: Config;
  workspaceBase: string;
  skillsDir: string;
  logsDir: string;
  currentProject: string | null;
  projectPath: string | null;
  verbose: boolean;
  runCount: number;
}

function slugifyTask(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

function printBanner(state: ReplState): void {
  const provider = state.config.llmProvider;
  const model = getActiveModel(state.config);

  console.log("");
  console.log("╭─────────────────────────────────────────────╮");
  console.log(`│  Agent OS v0.1.0                            │`);
  console.log(`│  Provider: ${(provider + " (" + model + ")").padEnd(33)}│`);
  if (state.currentProject) {
    console.log(`│  Project:  ${state.currentProject.padEnd(33)}│`);
  } else {
    console.log(`│  Project:  (none — type to create one)      │`);
  }
  console.log("╰─────────────────────────────────────────────╯");
  console.log("");
  console.log("  Type a task, or use /help for commands.");
  console.log("");
}

function getActiveModel(config: Config): string {
  switch (config.llmProvider) {
    case "openai": return config.openaiModel;
    case "gemini": return config.geminiModel;
    case "ollama": return config.ollamaModel;
    default: return config.llmProvider;
  }
}

function setActiveModel(config: Config, model: string): void {
  switch (config.llmProvider) {
    case "openai": config.openaiModel = model; break;
    case "gemini": config.geminiModel = model; break;
    case "ollama": config.ollamaModel = model; break;
  }
}

function printHelp(): void {
  console.log(`
Commands:
  /project <name>    Switch to an existing project
  /projects          List all projects in workspace
  /new <name>        Create and switch to a new empty project
  /status            Show current project file tree
  /model <name>      Switch model (e.g. gpt-4o, llama3, gemini-pro)
  /history           Show tasks run in this session
  /config            Show current configuration
  /clear             Reset session (keep project)
  /help              Show this help
  /exit              Exit the REPL

Tips:
  • Your first prompt auto-creates a project from the task description
  • Use /project <name> to resume work on an existing project
  • Follow-up prompts target the current project automatically
  • Use /model to switch models mid-session (e.g. /model gpt-4o)
  • Use /provider to switch providers (e.g. /provider ollama)
`);
}

function listProjects(workspaceBase: string): { name: string; files: number; modified: Date }[] {
  if (!existsSync(workspaceBase)) return [];
  try {
    return readdirSync(workspaceBase)
      .filter(e => {
        try { return statSync(resolve(workspaceBase, e)).isDirectory(); }
        catch { return false; }
      })
      .map(name => {
        const fullPath = resolve(workspaceBase, name);
        const stat = statSync(fullPath);
        const files = scanProject(fullPath);
        return { name, files: files.length, modified: stat.mtime };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } catch {
    return [];
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function setupProject(state: ReplState, projectName: string): boolean {
  const projectPath = resolve(state.workspaceBase, projectName);
  if (!existsSync(projectPath)) {
    console.log(`  ✗ Project "${projectName}" not found.`);
    const projects = listProjects(state.workspaceBase);
    if (projects.length > 0) {
      console.log(`  Available: ${projects.map(p => p.name).join(", ")}`);
    }
    return false;
  }
  state.currentProject = projectName;
  state.projectPath = projectPath;
  const files = scanProject(projectPath);
  console.log(`  ✓ Switched to: ${projectName} (${files.length} files)`);
  return true;
}

function createNewProject(state: ReplState, projectName: string): void {
  const projectPath = resolve(state.workspaceBase, projectName);
  if (existsSync(projectPath)) {
    console.log(`  Project "${projectName}" already exists. Use /project ${projectName} to switch.`);
    return;
  }
  mkdirSync(projectPath, { recursive: true });
  state.currentProject = projectName;
  state.projectPath = projectPath;
  console.log(`  ✓ Created and switched to: ${projectName}`);
}

function buildRegistry(workspace: string): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createListFilesTool(workspace));
  registry.register(createReadFileTool(workspace));
  registry.register(createWriteFileTool(workspace));
  registry.register(createShellTool({ workspaceRoot: workspace }));
  return registry;
}

async function runTask(state: ReplState, taskDescription: string): Promise<void> {
  // If no project yet, auto-create from task
  if (!state.currentProject || !state.projectPath) {
    const projectName = slugifyTask(taskDescription);
    const projectPath = resolve(state.workspaceBase, projectName);
    mkdirSync(projectPath, { recursive: true });
    state.currentProject = projectName;
    state.projectPath = projectPath;
    console.log(`  ✓ Created project: ${projectName}`);
  }

  const workspace = state.projectPath;

  // Scan existing project for context
  let projectTree: string | undefined;
  const files = scanProject(workspace);
  if (files.length > 0) {
    projectTree = formatProjectTree(files);
  }

  // Build registry fresh for current workspace
  const registry = buildRegistry(workspace);

  // Select skills
  const allSkills = loadAllSkills(state.skillsDir);
  const task = createTask(taskDescription);
  const selectedSkills = selectSkillsForTask(allSkills, task.description);

  if (state.verbose && selectedSkills.length > 0) {
    console.log(`  Skills: ${selectedSkills.map(s => s.name).join(", ")}`);
  }

  // Event bus for live output
  const eventBus = new EventBus();
  mkdirSync(state.logsDir, { recursive: true });
  const runLogger = new RunLogger({ logsDir: state.logsDir });

  // Memory
  const memoryDir = resolve("./.agent-os/memory");
  const memoryStore = new FileMemoryStore(memoryDir);

  // Provider
  const provider = createProvider(state.config, { tools: registry.list() });

  // Agent
  const agent = new Agent(provider, {
    maxSteps: state.config.maxSteps,
    registry,
    skills: selectedSkills,
    memoryStore,
    eventBus,
    runLogger,
    projectTree,
  });

  const result = await agent.execute(task);
  state.runCount++;

  // Output
  console.log("");
  if (result.success) {
    console.log(`  ✓ Done (${result.totalSteps} steps, ${(result.duration / 1000).toFixed(1)}s)`);
    console.log("");
    // Print output, indented
    const lines = result.output.split("\n");
    for (const line of lines.slice(0, 30)) {
      console.log(`  ${line}`);
    }
    if (lines.length > 30) {
      console.log(`  ... (${lines.length - 30} more lines)`);
    }
  } else {
    console.log(`  ✗ Failed (${result.totalSteps} steps, ${(result.duration / 1000).toFixed(1)}s)`);
    console.log(`  ${result.output}`);
  }
  console.log("");
}

export async function replCommand(args: ParsedArgs): Promise<void> {
  // Load config
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

  const state: ReplState = {
    config,
    workspaceBase: resolve((args.flags.workspace as string) ?? config.workspaceRoot),
    skillsDir: resolve((args.flags["skills-dir"] as string) ?? "./skills"),
    logsDir: resolve((args.flags["logs-dir"] as string) ?? "./.agent-os/logs"),
    currentProject: null,
    projectPath: null,
    verbose: args.flags.verbose === true,
    runCount: 0,
  };

  // Ensure workspace base exists
  mkdirSync(state.workspaceBase, { recursive: true });

  // Handle --project flag or positional path arg
  if (args.flags.project) {
    const projectName = args.flags.project as string;
    const projectPath = resolve(state.workspaceBase, projectName);
    if (existsSync(projectPath)) {
      state.currentProject = projectName;
      state.projectPath = projectPath;
    } else {
      console.error(`Error: project "${projectName}" not found.`);
      const projects = listProjects(state.workspaceBase);
      if (projects.length > 0) {
        console.log("Available projects:");
        projects.forEach(p => console.log(`  ${p.name} (${p.files} files, ${formatTimeAgo(p.modified)})`));
      }
      process.exit(1);
    }
  } else if (args.positional[0] && args.positional[0] !== "help") {
    // agent-os . or agent-os /path/to/project
    const targetPath = resolve(args.positional[0]);
    if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
      state.currentProject = basename(targetPath);
      state.projectPath = targetPath;
      // Override workspaceBase to parent
      state.workspaceBase = resolve(targetPath, "..");
    }
  }

  const sessionHistory: string[] = [];

  printBanner(state);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: state.currentProject ? `${state.currentProject} > ` : "> ",
    terminal: true,
  });

  function updatePrompt(): void {
    rl.setPrompt(state.currentProject ? `${state.currentProject} > ` : "> ");
  }

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith("/")) {
      const [cmd, ...rest] = input.split(/\s+/);
      const arg = rest.join(" ").trim();

      switch (cmd) {
        case "/exit":
        case "/quit":
        case "/q":
          console.log("\nGoodbye!\n");
          process.exit(0);

        case "/help":
        case "/h":
          printHelp();
          break;

        case "/project":
        case "/p":
          if (!arg) {
            if (state.currentProject) {
              console.log(`  Current project: ${state.currentProject}`);
            } else {
              console.log("  No project selected. Usage: /project <name>");
            }
          } else {
            setupProject(state, arg);
            updatePrompt();
          }
          break;

        case "/projects":
        case "/ls": {
          const projects = listProjects(state.workspaceBase);
          if (projects.length === 0) {
            console.log("  No projects yet. Type a task to create one.\n");
          } else {
            console.log("");
            for (const p of projects) {
              const marker = p.name === state.currentProject ? " ◀" : "";
              console.log(`  ${p.name.padEnd(35)} ${String(p.files).padStart(4)} files   ${formatTimeAgo(p.modified).padStart(10)}${marker}`);
            }
            console.log("");
          }
          break;
        }

        case "/new":
        case "/n":
          if (!arg) {
            console.log("  Usage: /new <project-name>");
          } else {
            createNewProject(state, arg);
            updatePrompt();
          }
          break;

        case "/status":
        case "/s":
          if (!state.projectPath) {
            console.log("  No project selected. Use /project <name> first.\n");
          } else {
            const files = scanProject(state.projectPath);
            if (files.length === 0) {
              console.log("  (empty project)\n");
            } else {
              console.log("");
              console.log(formatProjectTree(files).split("\n").map(l => `  ${l}`).join("\n"));
              console.log(`\n  ${files.length} files total\n`);
            }
          }
          break;

        case "/history":
          if (sessionHistory.length === 0) {
            console.log("  No tasks run yet in this session.\n");
          } else {
            console.log("");
            sessionHistory.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
            console.log("");
          }
          break;

        case "/model":
        case "/m":
          if (!arg) {
            console.log(`  Current model: ${getActiveModel(state.config)} (${state.config.llmProvider})`);
          } else {
            setActiveModel(state.config, arg);
            console.log(`  ✓ Model switched to: ${arg} (${state.config.llmProvider})`);
          }
          break;

        case "/provider":
          if (!arg) {
            console.log(`  Current provider: ${state.config.llmProvider} (${getActiveModel(state.config)})`);
          } else if (["mock", "openai", "gemini", "ollama"].includes(arg)) {
            state.config.llmProvider = arg;
            console.log(`  ✓ Provider switched to: ${arg} (${getActiveModel(state.config)})`);
          } else {
            console.log(`  Unknown provider: ${arg}. Supported: mock, openai, gemini, ollama`);
          }
          break;

        case "/config":
          console.log(`\n  Provider:  ${state.config.llmProvider}`);
          console.log(`  Model:     ${getActiveModel(state.config)}`);
          console.log(`  Max steps: ${state.config.maxSteps}`);
          console.log(`  Workspace: ${state.workspaceBase}`);
          console.log(`  Project:   ${state.currentProject ?? "(none)"}\n`);
          break;

        case "/clear":
          sessionHistory.length = 0;
          console.log("  Session cleared. Project unchanged.\n");
          break;

        default:
          console.log(`  Unknown command: ${cmd}. Type /help for available commands.\n`);
      }

      rl.prompt();
      return;
    }

    // Run the task
    sessionHistory.push(input);
    try {
      await runTask(state, input);
      updatePrompt();
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!\n");
    process.exit(0);
  });
}
