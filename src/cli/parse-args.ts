export interface ParsedArgs {
  command: string;
  task?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node and script path
  const args = argv.slice(2);

  const command = args[0] ?? "help";
  const remaining = args.slice(1);

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
Agent OS — CLI

Usage:
  agent-os run "<task>"          Run a task
  agent-os run "<task>" --provider openai
  agent-os run "<task>" --max-steps 5
  agent-os run "<task>" --workspace ./my-project
  agent-os run "<task>" --skills-dir ./skills
  agent-os run "<task>" --logs-dir ./logs
  agent-os help                  Show this help

Options:
  --provider <name>    LLM provider (mock, openai, gemini, ollama)
  --max-steps <n>      Maximum agent loop steps (default: 10)
  --workspace <path>   Workspace root directory (default: .)
  --skills-dir <path>  Skills directory (default: ./skills)
  --logs-dir <path>    JSONL logs directory (default: ./.agent-os/logs)
  --verbose            Enable verbose logging
`.trim();
}
