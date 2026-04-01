export type EventType =
  | "run:start"
  | "run:complete"
  | "run:fail"
  | "run:max_steps"
  | "step:think"
  | "step:act"
  | "step:observe"
  | "tool:call"
  | "tool:result"
  | "loop:finalize";

export interface AgentEvent {
  type: EventType;
  timestamp: string;
  runId: string;
  data: Record<string, unknown>;
}

export type EventHandler = (event: AgentEvent) => void;

export class EventBus {
  private handlers = new Map<EventType | "*", EventHandler[]>();

  on(type: EventType | "*", handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  off(type: EventType | "*", handler: EventHandler): void {
    const list = this.handlers.get(type);
    if (!list) return;
    this.handlers.set(type, list.filter(h => h !== handler));
  }

  emit(event: AgentEvent): void {
    // Specific handlers
    const specific = this.handlers.get(event.type) ?? [];
    for (const handler of specific) handler(event);

    // Wildcard handlers
    const wildcard = this.handlers.get("*") ?? [];
    for (const handler of wildcard) handler(event);
  }
}

export function createEvent(
  type: EventType,
  runId: string,
  data: Record<string, unknown> = {}
): AgentEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    runId,
    data,
  };
}
