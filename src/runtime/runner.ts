import { LLMProvider } from "../core/types.js";
import { Task, createTask } from "../core/task.js";
import { AgentResult } from "../core/result.js";
import { Agent, AgentOptions } from "../agent/agent.js";

export type AgentRole = "planner" | "executor" | "general";

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: string;
  error?: string;
}

export interface Plan {
  taskId: string;
  taskDescription: string;
  steps: PlanStep[];
  createdAt: string;
}

export function createPlan(task: Task, stepDescriptions: string[]): Plan {
  return {
    taskId: task.id,
    taskDescription: task.description,
    steps: stepDescriptions.map((desc, i) => ({
      id: `step_${i + 1}`,
      description: desc,
      status: "pending",
    })),
    createdAt: new Date().toISOString(),
  };
}

export function parsePlanFromText(text: string): string[] {
  // Parse numbered or bulleted plan steps from LLM output
  const lines = text.split("\n");
  const steps: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "1. step", "- step", "* step", "1) step"
    const match = trimmed.match(/^(?:\d+[\.\)]\s*|[-*]\s+)(.+)/);
    if (match) {
      steps.push(match[1].trim());
    }
  }

  return steps;
}

export interface PlannerExecutorOptions {
  provider: LLMProvider;
  agentOptions: Omit<AgentOptions, "maxSteps">;
  plannerMaxSteps?: number;
  executorMaxSteps?: number;
}

export class PlannerExecutor {
  private provider: LLMProvider;
  private agentOptions: Omit<AgentOptions, "maxSteps">;
  private plannerMaxSteps: number;
  private executorMaxSteps: number;

  constructor(options: PlannerExecutorOptions) {
    this.provider = options.provider;
    this.agentOptions = options.agentOptions;
    this.plannerMaxSteps = options.plannerMaxSteps ?? 3;
    this.executorMaxSteps = options.executorMaxSteps ?? 10;
  }

  async plan(task: Task): Promise<Plan> {
    const plannerTask = createTask(
      `Create a step-by-step plan to accomplish this task. Output ONLY a numbered list of steps, nothing else.\n\nTask: ${task.description}`,
      task.input
    );

    const planner = new Agent(this.provider, {
      ...this.agentOptions,
      maxSteps: this.plannerMaxSteps,
    });

    const result = await planner.execute(plannerTask);
    const stepDescriptions = parsePlanFromText(result.output);

    if (stepDescriptions.length === 0) {
      // Fallback: treat entire output as a single step
      return createPlan(task, [task.description]);
    }

    return createPlan(task, stepDescriptions);
  }

  async execute(plan: Plan): Promise<{ plan: Plan; results: AgentResult[] }> {
    const results: AgentResult[] = [];

    for (const step of plan.steps) {
      if (step.status === "skipped") continue;

      step.status = "running";
      console.log(`\n[PlannerExecutor] Executing step ${step.id}: ${step.description}`);

      const stepTask = createTask(
        step.description,
        `This is part of a larger plan: ${plan.taskDescription}`
      );

      const executor = new Agent(this.provider, {
        ...this.agentOptions,
        maxSteps: this.executorMaxSteps,
      });

      const result = await executor.execute(stepTask);
      results.push(result);

      if (result.success) {
        step.status = "completed";
        step.result = result.output;
      } else {
        step.status = "failed";
        step.error = result.output;
        // Don't skip remaining steps — let them attempt
      }
    }

    return { plan, results };
  }

  async planAndExecute(task: Task): Promise<{ plan: Plan; results: AgentResult[] }> {
    console.log(`\n[PlannerExecutor] Planning task: ${task.description}`);
    const plan = await this.plan(task);
    console.log(`[PlannerExecutor] Plan has ${plan.steps.length} steps`);

    for (const step of plan.steps) {
      console.log(`  ${step.id}: ${step.description}`);
    }

    return this.execute(plan);
  }
}
