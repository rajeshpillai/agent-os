import { AgentResult } from "../core/result.js";

export interface HandoffEnvelope {
  fromAgent: string;
  toAgent: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentLogEntry {
  agentId: string;
  runId: string;
  taskDescription: string;
  result: AgentResult;
  timestamp: string;
}

export class SharedContext {
  private data = new Map<string, unknown>();
  private agentLogs: AgentLogEntry[] = [];
  private handoffs: HandoffEnvelope[] = [];

  // --- Key-value shared state ---

  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }

  // --- Per-agent logs ---

  logAgentRun(entry: AgentLogEntry): void {
    this.agentLogs.push(entry);
  }

  getAgentLogs(agentId?: string): AgentLogEntry[] {
    if (agentId) {
      return this.agentLogs.filter(l => l.agentId === agentId);
    }
    return [...this.agentLogs];
  }

  // --- Handoff envelopes ---

  sendHandoff(envelope: HandoffEnvelope): void {
    this.handoffs.push(envelope);
  }

  receiveHandoffs(agentId: string): HandoffEnvelope[] {
    return this.handoffs.filter(h => h.toAgent === agentId);
  }

  getAllHandoffs(): HandoffEnvelope[] {
    return [...this.handoffs];
  }

  // --- Utilities ---

  toSummary(): string {
    const lines: string[] = [];

    if (this.data.size > 0) {
      lines.push("## Shared State");
      for (const [key, value] of this.data) {
        const valStr = typeof value === "string" ? value : JSON.stringify(value);
        const truncated = valStr.length > 100 ? valStr.slice(0, 100) + "..." : valStr;
        lines.push(`- ${key}: ${truncated}`);
      }
    }

    if (this.agentLogs.length > 0) {
      lines.push("\n## Agent Run History");
      for (const log of this.agentLogs) {
        const status = log.result.success ? "✓" : "✗";
        lines.push(`- [${status}] ${log.agentId}: ${log.taskDescription} (${log.result.totalSteps} steps)`);
      }
    }

    if (this.handoffs.length > 0) {
      lines.push("\n## Handoffs");
      for (const h of this.handoffs) {
        lines.push(`- ${h.fromAgent} → ${h.toAgent}: ${h.message}`);
      }
    }

    return lines.join("\n");
  }
}

export function createHandoff(
  from: string,
  to: string,
  message: string,
  data?: Record<string, unknown>
): HandoffEnvelope {
  return {
    fromAgent: from,
    toAgent: to,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}
