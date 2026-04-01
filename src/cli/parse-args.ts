export interface ParsedArgs {
  command: string;
  task?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node and script path
  const args = argv.slice(2);

  // If first arg is a known command, use it. Otherwise treat as REPL invocation.
  const knownCommands = new Set(["run", "help", "--help", "-h"]);
  const firstArg = args[0];
  const command = firstArg && knownCommands.has(firstArg) ? firstArg : "repl";
  const remaining = command === "repl" ? args : args.slice(1);

  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < remaining.length) {
    const arg = remaining[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const eqIdx = key.indexOf("=");

      if (eqIdx !== -1) {
        // --key=value
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else if (i + 1 < remaining.length && !remaining[i + 1].startsWith("--")) {
        // --key value
        flags[key] = remaining[i + 1];
        i++;
      } else {
        // --flag (boolean)
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  // First positional is the task description for "run" command
  const task = command === "run" ? positional[0] : undefined;

  return { command, task, flags, positional };
}

export function showHelp(): string {
  return `
Agent OS — AI-powered development CLI

Usage:
  agent-os                               Interactive REPL (default)
  agent-os --project todo-app            REPL with existing project loaded
  agent-os .                             REPL with current directory as project
  agent-os run "<task>"                  One-shot: create a new project
  agent-os run "<task>" --project my-app One-shot: modify existing project
  agent-os help                          Show this help

Interactive REPL commands:
  /project <name>    Switch to an existing project
  /projects          List all projects
  /new <name>        Create a new empty project
  /status            Show current project files
  /history           Show tasks run this session
  /config            Show configuration
  /help              Show all commands
  /exit              Exit

Options:
  --provider <name>    LLM provider (mock, openai, gemini, ollama)
  --model <name>       Override the model (e.g. gpt-4o, llama3, gemini-pro)
  --max-steps <n>      Maximum agent loop steps (default: 10)
  --name <name>        Project folder name (default: auto-generated from task)
  --project <name>     Target an existing project
  --workspace <path>   Workspace root directory (default: ./workspace)
  --skills-dir <path>  Skills directory (default: ./skills)
  --logs-dir <path>    JSONL logs directory (default: ./.agent-os/logs)
  --verbose            Enable verbose logging

Examples:
  agent-os                                         # start REPL
  agent-os --project todo-app --provider openai    # REPL on existing project
  agent-os run "Create a todo app" --name todo-app # one-shot create
  agent-os run "Fix the bug" --project todo-app    # one-shot modify
`.trim();
}
