import { Task } from "../core/task.js";
import { Run } from "../core/run.js";
import { MemoryEntry, MemoryStore } from "./memory-store.js";

export async function saveTaskMemory(store: MemoryStore, task: Task): Promise<void> {
  const entry: MemoryEntry = {
    id: task.id,
    type: "task",
    content: task.description + (task.input ? `\nInput: ${task.input}` : ""),
    metadata: { taskId: task.id },
    createdAt: task.createdAt,
  };
  await store.save(entry);
}

export async function saveRunMemory(store: MemoryStore, run: Run): Promise<void> {
  const entry: MemoryEntry = {
    id: run.id,
    type: "run",
    content: JSON.stringify({
      status: run.status,
      result: run.result,
      error: run.error,
      stepCount: run.steps.length,
    }),
    metadata: {
      taskId: run.taskId,
      status: run.status,
    },
    createdAt: run.startedAt,
  };
  await store.save(entry);
}

export async function saveSummary(
  store: MemoryStore,
  taskId: string,
  summary: string
): Promise<void> {
  const entry: MemoryEntry = {
    id: `summary_${taskId}_${Date.now()}`,
    type: "summary",
    content: summary,
    metadata: { taskId },
    createdAt: new Date().toISOString(),
  };
  await store.save(entry);
}

export async function getTaskHistory(
  store: MemoryStore,
  taskId: string
): Promise<MemoryEntry[]> {
  return store.query({ taskId });
}

export async function getRecentMemory(
  store: MemoryStore,
  limit = 10
): Promise<MemoryEntry[]> {
  return store.query({ limit });
}
