export interface MemoryEntry {
  id: string;
  type: "task" | "run" | "summary" | "fact";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryQuery {
  type?: MemoryEntry["type"];
  taskId?: string;
  limit?: number;
}

export interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  load(id: string): Promise<MemoryEntry | null>;
  query(query: MemoryQuery): Promise<MemoryEntry[]>;
  list(): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
}
