import { StepRecord } from "./types.js";
import { Task } from "./task.js";

export type RunStatus = "running" | "completed" | "failed" | "max_steps_reached";

export interface Run {
  id: string;
  taskId: string;
  status: RunStatus;
  steps: StepRecord[];
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export function createRun(task: Task): Run {
  return {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskId: task.id,
    status: "running",
    steps: [],
    startedAt: new Date().toISOString(),
  };
}

export function completeRun(run: Run, result: string): Run {
  return {
    ...run,
    status: "completed",
    result,
    completedAt: new Date().toISOString(),
  };
}

export function failRun(run: Run, error: string): Run {
  return {
    ...run,
    status: "failed",
    error,
    completedAt: new Date().toISOString(),
  };
}
