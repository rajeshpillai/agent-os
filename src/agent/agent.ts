import { LLMProvider, Message, StepRecord } from "../core/types.js";
import { Task } from "../core/task.js";
import { Run, createRun, completeRun, failRun } from "../core/run.js";
import { AgentResult } from "../core/result.js";

export interface AgentOptions {
  maxSteps: number;
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
      { role: "system", content: "You are a helpful agent. Complete the given task." },
      { role: "user", content: task.description + (task.input ? `\n\nInput: ${task.input}` : "") },
    ];

    console.log(`\n[Agent] Starting run ${run.id} for task: ${task.description}`);

    try {
      for (let step = 1; step <= this.options.maxSteps; step++) {
        console.log(`[Agent] Step ${step}/${this.options.maxSteps}`);

        const response = await this.provider.chat(messages);

        const stepRecord: StepRecord = {
          stepNumber: step,
          input: [...messages],
          output: response,
          timestamp: new Date().toISOString(),
        };
        run.steps.push(stepRecord);

        messages.push(response.message);

        console.log(`[Agent] Assistant: ${response.message.content.slice(0, 100)}...`);

        if (response.stopReason === "end_turn" && !response.message.toolCalls?.length) {
          run = completeRun(run, response.message.content);
          break;
        }
      }

      if (run.status === "running") {
        run = { ...run, status: "max_steps_reached", completedAt: new Date().toISOString() };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      run = failRun(run, errorMessage);
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
