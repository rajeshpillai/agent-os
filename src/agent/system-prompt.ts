import { Task } from "../core/task.js";

export function buildSystemPrompt(task: Task): string {
  return [
    "You are an AI agent running inside Agent OS.",
    "",
    "## Instructions",
    "- Think step by step before acting.",
    "- Use available tools when needed.",
    "- When the task is complete, provide your final answer directly (no tool call).",
    "- If you cannot complete the task, explain why.",
    "",
    `## Task: ${task.description}`,
  ].join("\n");
}
