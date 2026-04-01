import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AgentContext } from "./context-builder.js";
import { formatSkillsForPrompt } from "../skills/skill-loader.js";
import { ToolDefinition } from "../tools/tool.js";
import { MemoryEntry } from "../memory/memory-store.js";
import { Task } from "../core/task.js";

function loadBasePrompt(): string {
  try {
    const path = resolve("src/prompts/base-system-prompt.md");
    return readFileSync(path, "utf-8").trim();
  } catch {
    return "You are an AI agent running inside Agent OS. Complete the given task using available tools.";
  }
}

function formatToolDescriptions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "";

  const lines = tools.map(tool => {
    const params = tool.parameters
      .map(p => `${p.name}${p.required ? " (required)" : ""}: ${p.description}`)
      .join("\n    ");
    return `- **${tool.name}**: ${tool.description}\n    ${params}`;
  });

  return "## Available Tools\n\n" + lines.join("\n\n");
}

function formatMemoryContext(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  const lines = entries.map(entry => {
    const prefix = `[${entry.type}]`;
    const content = entry.content.length > 200
      ? entry.content.slice(0, 200) + "..."
      : entry.content;
    return `${prefix} ${content}`;
  });

  return "## Memory Context\n\nRelevant information from previous runs:\n\n" + lines.join("\n\n");
}

function formatTaskEnvelope(task: Task): string {
  let envelope = `## Current Task\n\n**${task.description}**`;
  if (task.input) {
    envelope += `\n\n### Input\n\n${task.input}`;
  }
  return envelope;
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const parts: string[] = [];

  // 1. Base prompt
  parts.push(loadBasePrompt());

  // 2. Tool descriptions
  if (ctx.tools?.length) {
    parts.push(formatToolDescriptions(ctx.tools));
  }

  // 3. Skills
  if (ctx.skills?.length) {
    parts.push(formatSkillsForPrompt(ctx.skills));
  }

  // 4. Memory context
  if (ctx.memory?.length) {
    parts.push(formatMemoryContext(ctx.memory));
  }

  // 5. Task envelope
  parts.push(formatTaskEnvelope(ctx.task));

  return parts.join("\n\n");
}
