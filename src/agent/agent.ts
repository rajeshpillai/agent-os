import { LLMProvider, Message, ToolExecutor } from "../core/types.js";
import { Task } from "../core/task.js";
import { Run, createRun, completeRun, failRun } from "../core/run.js";
import { AgentResult } from "../core/result.js";
import { ToolRegistry } from "../tools/registry.js";
import { MemoryStore } from "../memory/memory-store.js";
import { saveTaskMemory, saveRunMemory, getRecentMemory } from "../memory/helpers.js";
import { summarizeAndSave } from "../memory/summary.js";
import { Skill } from "../skills/models.js";
import { EventBus, createEvent } from "../runtime/event-bus.js";
import { RunLogger } from "../runtime/run-logger.js";
import { ApprovalGate } from "../runtime/approval.js";
import { buildContext } from "./context-builder.js";
import { runLoop } from "./loop.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface AgentOptions {
  maxSteps: number;
  toolExecutor?: ToolExecutor;
  registry?: ToolRegistry;
  memoryStore?: MemoryStore;
  skills?: Skill[];
  eventBus?: EventBus;
  runLogger?: RunLogger;
  approvalGate?: ApprovalGate;
}

export class Agent {
  private provider: LLMProvider;
  private options: AgentOptions;

  constructor(provider: LLMProvider, options: AgentOptions) {
    this.provider = provider;
    this.options = options;
  }

  async execute(task: Task): Promise<AgentResult> {
    const startTime = Date.now();
    let run = createRun(task);

    // Set up event bus and attach logger
    const eventBus = this.options.eventBus ?? new EventBus();
    if (this.options.runLogger) {
      this.options.runLogger.attachTo(eventBus);
    }

    // Load recent memory if store is available
    const recentMemory = this.options.memoryStore
      ? await getRecentMemory(this.options.memoryStore, 5)
      : undefined;

    // Build full context
    const ctx = buildContext({
      task,
      tools: this.options.registry?.list(),
      skills: this.options.skills,
      memory: recentMemory,
    });

    const messages: Message[] = [
      { role: "system", content: buildSystemPrompt(ctx) },
      { role: "user", content: task.description + (task.input ? `\n\nInput: ${task.input}` : "") },
    ];

    console.log(`\n[Agent] Starting run ${run.id} for task: ${task.description}`);

    eventBus.emit(createEvent("run:start", run.id, {
      taskId: task.id,
      taskDescription: task.description,
      maxSteps: this.options.maxSteps,
    }));

    // Prefer registry executor over raw toolExecutor
    const toolExecutor = this.options.registry
      ? this.options.registry.toExecutor()
      : this.options.toolExecutor;

    try {
      const loopResult = await runLoop(this.provider, messages, {
        maxSteps: this.options.maxSteps,
        toolExecutor,
        eventBus,
        runId: run.id,
        approvalGate: this.options.approvalGate,
      });

      run.steps = loopResult.steps;

      switch (loopResult.stopReason) {
        case "complete":
          run = completeRun(run, loopResult.finalOutput);
          eventBus.emit(createEvent("run:complete", run.id, {
            output: loopResult.finalOutput.slice(0, 500),
            totalSteps: loopResult.steps.length,
          }));
          break;
        case "max_steps":
          run = {
            ...run,
            status: "max_steps_reached",
            result: loopResult.finalOutput,
            completedAt: new Date().toISOString(),
          };
          eventBus.emit(createEvent("run:max_steps", run.id, {
            totalSteps: loopResult.steps.length,
          }));
          break;
        case "error":
        case "tool_error":
          run = failRun(run, loopResult.finalOutput);
          eventBus.emit(createEvent("run:fail", run.id, {
            error: loopResult.finalOutput.slice(0, 500),
          }));
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      run = failRun(run, errorMessage);
      eventBus.emit(createEvent("run:fail", run.id, { error: errorMessage }));
    }

    // Persist to memory if store is provided
    if (this.options.memoryStore) {
      await saveTaskMemory(this.options.memoryStore, task);
      await saveRunMemory(this.options.memoryStore, run);
      await summarizeAndSave(this.options.memoryStore, task, run);
    }

    const duration = Date.now() - startTime;
    console.log(`[Agent] Run ${run.status} in ${duration}ms (${run.steps.length} steps)`);

    return {
      success: run.status === "completed",
      output: run.result ?? run.error ?? "No output",
      totalSteps: run.steps.length,
      runId: run.id,
      taskId: task.id,
      duration,
    };
  }
}
