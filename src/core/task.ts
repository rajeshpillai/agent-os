export interface Task {
  id: string;
  description: string;
  input?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function createTask(description: string, input?: string): Task {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    description,
    input,
    createdAt: new Date().toISOString(),
  };
}
