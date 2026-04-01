import { LLMProvider, Message, ToolExecutor } from "../core/types.js";
import { Task } from "../core/task.js";
import { Run, createRun, completeRun, failRun } from "../core/run.js";
import { AgentResult } from "../core/result.js";
import { ToolRegistry } from "../tools/registry.js";
import { MemoryStore } from "../memory/memory-store.js";
import { saveTaskMemory, saveRunMemory } from "../memory/helpers.js";
import { runLoop } from "./loop.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface AgentOptions {
  maxSteps: number;
  toolExecutor?: ToolExecutor;
  registry?: ToolRegistry;
  memoryStore?: MemoryStore;
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

    const messages: Message[] = [
      { role: "system", content: buildSystemPrompt(task) },
      { role: "user", content: task.description + (task.input ? `\n\nInput: ${task.input}` : "") },
    ];

    console.log(`\n[Agent] Starting run ${run.id} for task: ${task.description}`);

    // Prefer registry executor over raw toolExecutor
    const toolExecutor = this.options.registry
      ? this.options.registry.toExecutor()
      : this.options.toolExecutor;

    try {
      const loopResult = await runLoop(this.provider, messages, {
        maxSteps: this.options.maxSteps,
        toolExecutor,
      });

      run.steps = loopResult.steps;

      switch (loopResult.stopReason) {
        case "complete":
          run = completeRun(run, loopResult.finalOutput);
          break;
        case "max_steps":
          run = {
            ...run,
            status: "max_steps_reached",
            result: loopResult.finalOutput,
            completedAt: new Date().toISOString(),
          };
          break;
        case "error":
        case "tool_error":
          run = failRun(run, loopResult.finalOutput);
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      run = failRun(run, errorMessage);
    }

    // Persist to memory if store is provided
    if (this.options.memoryStore) {
      await saveTaskMemory(this.options.memoryStore, task);
      await saveRunMemory(this.options.memoryStore, run);
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
