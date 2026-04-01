import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { Tool } from "../tool.js";

export interface ShellToolConfig {
  workspaceRoot: string;
  timeoutMs?: number;
  longTimeoutMs?: number;
  allowedCommands?: string[];
  blockedCommands?: string[];
}

const DEFAULT_BLOCKED_COMMANDS = [
  "rm -rf /",
  "rm -rf ~",
  "mkfs",
  "dd if=",
  ":(){",
  "fork bomb",
  "shutdown",
  "reboot",
  "poweroff",
  "halt",
  "init 0",
  "init 6",
  "chmod -R 777 /",
  "chown -R",
  "> /dev/sda",
  "curl | sh",
  "wget | sh",
  "curl | bash",
  "wget | bash",
];

function extractBaseCommand(command: string): string {
  const trimmed = command.trim();
  // Handle env vars prefix like VAR=val cmd
  const parts = trimmed.split(/\s+/);
  for (const part of parts) {
    if (!part.includes("=")) return part;
  }
  return parts[0];
}

function isBlocked(command: string, blockedCommands: string[]): string | null {
  const lower = command.toLowerCase().trim();
  for (const blocked of blockedCommands) {
    if (lower.includes(blocked.toLowerCase())) {
      return blocked;
    }
  }
  return null;
}

function isAllowed(command: string, allowedCommands?: string[]): boolean {
  if (!allowedCommands || allowedCommands.length === 0) return true;
  const base = extractBaseCommand(command);
  return allowedCommands.includes(base);
}

export function createShellTool(config: ShellToolConfig): Tool {
  const {
    workspaceRoot,
    timeoutMs = 30_000,
    longTimeoutMs = 120_000,
    allowedCommands,
    blockedCommands = DEFAULT_BLOCKED_COMMANDS,
  } = config;

  const resolvedRoot = resolve(workspaceRoot);

  return {
    definition: {
      name: "shell",
      description:
        "Execute a shell command within the workspace. Commands are subject to safety checks: blocked dangerous commands are rejected, and an allowlist can restrict which commands are permitted.",
      parameters: [
        {
          name: "command",
          type: "string",
          description: "The shell command to execute. IMPORTANT: Do not start long-running servers (e.g. 'node server.js', 'npm start') — they will block and time out. Use write_file to create files rather than scaffolding tools like 'create-react-app'. For package installs (npm install), set timeout to 'long'.",
          required: true,
        },
        {
          name: "cwd",
          type: "string",
          description: "Working directory relative to workspace root. Defaults to workspace root.",
        },
        {
          name: "timeout",
          type: "string",
          description: "Timeout duration: 'short' (30s, default) or 'long' (120s, for npm install and builds).",
        },
      ],
    },
    async execute(args) {
      const command = args.command as string;
      if (!command) {
        throw new Error("The 'command' argument is required.");
      }

      // Safety: check blocked commands
      const blockedMatch = isBlocked(command, blockedCommands);
      if (blockedMatch) {
        throw new Error(`Command blocked for safety: contains "${blockedMatch}"`);
      }

      // Safety: check allowed commands
      if (!isAllowed(command, allowedCommands)) {
        const base = extractBaseCommand(command);
        throw new Error(
          `Command "${base}" is not in the allowed list. Allowed: ${allowedCommands!.join(", ")}`
        );
      }

      // Resolve cwd
      const relativeCwd = (args.cwd as string) || ".";
      const cwd = resolve(resolvedRoot, relativeCwd);
      if (!cwd.startsWith(resolvedRoot)) {
        throw new Error("Working directory is outside the workspace boundary.");
      }
      if (!existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${relativeCwd}`);
      }

      // Determine timeout: explicit arg, auto-detect for long commands, or default
      const timeoutArg = (args.timeout as string) || "";
      const isLongCommand = timeoutArg === "long" || /\b(npm install|npm ci|npx |yarn add|yarn install|pnpm install|pip install|cargo build|go build|mvn |gradle )\b/.test(command);
      const effectiveTimeout = isLongCommand ? longTimeoutMs : timeoutMs;

      try {
        const output = execSync(command, {
          cwd,
          timeout: effectiveTimeout,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024, // 1MB
          stdio: ["pipe", "pipe", "pipe"],
        });

        return output.trim() || "(no output)";
      } catch (error: unknown) {
        const err = error as { killed?: boolean; signal?: string; stderr?: string; message?: string };
        if (err.killed || err.signal === "SIGTERM") {
          throw new Error(`Command timed out after ${timeoutMs}ms`);
        }
        const stderr = String(err.stderr || err.message || "Unknown error").trim();
        // Show up to 500 chars of stderr so the agent can see which package/line failed
        const truncated = stderr.length > 500 ? stderr.slice(0, 500) + "\n...(truncated)" : stderr;
        throw new Error(`Command failed:\n${truncated}`);
      }
    },
  };
}
