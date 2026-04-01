import { Run } from "../core/run.js";
import { Task } from "../core/task.js";
import { StepRecord, ToolResult } from "../core/types.js";
import { MemoryStore } from "./memory-store.js";
import { saveSummary } from "./helpers.js";

export interface RunSummary {
  taskId: string;
  taskDescription: string;
  runId: string;
  status: string;
  totalSteps: number;
  toolsUsed: string[];
  result?: string;
  error?: string;
  duration?: number;
}

export function summarizeRun(task: Task, run: Run): RunSummary {
  const toolsUsed = new Set<string>();

  for (const step of run.steps) {
    if (step.toolResults) {
      for (const tr of step.toolResults) {
        toolsUsed.add(tr.name);
      }
    }
    // Also check tool calls from output
    if (step.output.message.toolCalls) {
      for (const tc of step.output.message.toolCalls) {
        toolsUsed.add(tc.name);
      }
    }
  }

  return {
    taskId: task.id,
    taskDescription: task.description,
    runId: run.id,
    status: run.status,
    totalSteps: run.steps.length,
    toolsUsed: Array.from(toolsUsed),
    result: run.result,
    error: run.error,
  };
}

export function formatSummary(summary: RunSummary): string {
  const lines: string[] = [
    `Task: ${summary.taskDescription}`,
    `Status: ${summary.status}`,
    `Steps: ${summary.totalSteps}`,
  ];

  if (summary.toolsUsed.length > 0) {
    lines.push(`Tools: ${summary.toolsUsed.join(", ")}`);
  }

  if (summary.result) {
    const truncated = summary.result.length > 300
      ? summary.result.slice(0, 300) + "..."
      : summary.result;
    lines.push(`Result: ${truncated}`);
  }

  if (summary.error) {
    lines.push(`Error: ${summary.error}`);
  }

  return lines.join("\n");
}

export async function summarizeAndSave(
  store: MemoryStore,
  task: Task,
  run: Run
): Promise<RunSummary> {
  const summary = summarizeRun(task, run);
  const formatted = formatSummary(summary);
  await saveSummary(store, task.id, formatted);
  return summary;
}

export function compressMemoryEntries(
  entries: { content: string }[],
  maxTokenBudget: number
): string[] {
  const compressed: string[] = [];
  let totalLength = 0;

  for (const entry of entries) {
    const content = entry.content;
    if (totalLength + content.length <= maxTokenBudget) {
      compressed.push(content);
      totalLength += content.length;
    } else {
      // Truncate last entry to fit budget
      const remaining = maxTokenBudget - totalLength;
      if (remaining > 50) {
        compressed.push(content.slice(0, remaining) + "...");
      }
      break;
    }
  }

  return compressed;
}
