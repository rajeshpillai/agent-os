import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { AgentEvent, EventBus } from "./event-bus.js";
import { appendJsonl, readJsonl } from "../storage/jsonl.js";

export interface RunLoggerOptions {
  logsDir: string;
}

export class RunLogger {
  private logsDir: string;

  constructor(options: RunLoggerOptions) {
    this.logsDir = options.logsDir;
    mkdirSync(this.logsDir, { recursive: true });
  }

  private logPath(runId: string): string {
    return join(this.logsDir, `${runId}.jsonl`);
  }

  logEvent(event: AgentEvent): void {
    appendJsonl(this.logPath(event.runId), event);
  }

  getRunLog(runId: string): AgentEvent[] {
    return readJsonl<AgentEvent>(this.logPath(runId));
  }

  attachTo(bus: EventBus): void {
    bus.on("*", (event) => this.logEvent(event));
  }
}
