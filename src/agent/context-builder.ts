import { Task } from "../core/task.js";
import { Skill } from "../skills/models.js";
import { ToolDefinition } from "../tools/tool.js";
import { MemoryEntry } from "../memory/memory-store.js";

export interface AgentContext {
  task: Task;
  tools?: ToolDefinition[];
  skills?: Skill[];
  memory?: MemoryEntry[];
}

export function buildContext(parts: {
  task: Task;
  tools?: ToolDefinition[];
  skills?: Skill[];
  memory?: MemoryEntry[];
}): AgentContext {
  return {
    task: parts.task,
    tools: parts.tools,
    skills: parts.skills,
    memory: parts.memory,
  };
}
