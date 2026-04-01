import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MemoryEntry, MemoryQuery, MemoryStore } from "./memory-store.js";

export class FileMemoryStore implements MemoryStore {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.ensureDirs();
  }

  private ensureDirs(): void {
    for (const sub of ["tasks", "runs", "summaries", "facts"]) {
      mkdirSync(join(this.baseDir, sub), { recursive: true });
    }
  }

  private dirForType(type: MemoryEntry["type"]): string {
    const map: Record<MemoryEntry["type"], string> = {
      task: "tasks",
      run: "runs",
      summary: "summaries",
      fact: "facts",
    };
    return join(this.baseDir, map[type]);
  }

  private filePath(entry: MemoryEntry): string {
    return join(this.dirForType(entry.type), `${entry.id}.json`);
  }

  private filePathById(type: MemoryEntry["type"], id: string): string {
    return join(this.dirForType(type), `${id}.json`);
  }

  async save(entry: MemoryEntry): Promise<void> {
    const path = this.filePath(entry);
    writeFileSync(path, JSON.stringify(entry, null, 2), "utf-8");
  }

  async load(id: string): Promise<MemoryEntry | null> {
    // Search across all type directories
    for (const type of ["task", "run", "summary", "fact"] as MemoryEntry["type"][]) {
      const path = this.filePathById(type, id);
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf-8");
        return JSON.parse(raw) as MemoryEntry;
      }
    }
    return null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const types: MemoryEntry["type"][] = query.type
      ? [query.type]
      : ["task", "run", "summary", "fact"];

    let results: MemoryEntry[] = [];

    for (const type of types) {
      const dir = this.dirForType(type);
      if (!existsSync(dir)) continue;

      const files = readdirSync(dir).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const raw = readFileSync(join(dir, file), "utf-8");
        const entry = JSON.parse(raw) as MemoryEntry;

        if (query.taskId && entry.metadata?.taskId !== query.taskId) {
          continue;
        }

        results.push(entry);
      }
    }

    // Sort by createdAt descending (newest first)
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async list(): Promise<MemoryEntry[]> {
    return this.query({});
  }

  async delete(id: string): Promise<boolean> {
    for (const type of ["task", "run", "summary", "fact"] as MemoryEntry["type"][]) {
      const path = this.filePathById(type, id);
      if (existsSync(path)) {
        unlinkSync(path);
        return true;
      }
    }
    return false;
  }
}
