import { Task } from "../core/task.js";
import { Skill } from "../skills/models.js";
import { formatSkillsForPrompt } from "../skills/skill-loader.js";

export interface SystemPromptContext {
  task: Task;
  skills?: Skill[];
}

export function buildSystemPrompt(ctx: SystemPromptContext | Task): string {
  // Support both Task (backward compat) and SystemPromptContext
  const task = "description" in ctx && !("task" in ctx) ? ctx as Task : (ctx as SystemPromptContext).task;
  const skills = "skills" in ctx ? (ctx as SystemPromptContext).skills : undefined;

  const parts: string[] = [
    "You are an AI agent running inside Agent OS.",
    "",
    "## Instructions",
    "- Think step by step before acting.",
    "- Use available tools when needed.",
    "- When the task is complete, provide your final answer directly (no tool call).",
    "- If you cannot complete the task, explain why.",
  ];

  if (skills?.length) {
    parts.push("", formatSkillsForPrompt(skills));
  }

  parts.push("", `## Task: ${task.description}`);

  return parts.join("\n");
}
