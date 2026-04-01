import { LLMProvider, LLMResponse, Message, ToolCall } from "../../core/types.js";

export interface MockStep {
  content: string;
  toolCalls?: ToolCall[];
}

export class MockProvider implements LLMProvider {
  private callCount = 0;
  private steps: MockStep[];

  constructor(steps?: (string | MockStep)[]) {
    this.steps = (steps ?? [
      "I'm analyzing the task. Let me think about this step by step.",
      "Based on my analysis, here is my conclusion:\n\nThe task has been completed successfully.",
    ]).map(s => (typeof s === "string" ? { content: s } : s));
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const stepIndex = Math.min(this.callCount, this.steps.length - 1);
    const step = this.steps[stepIndex];
    this.callCount++;

    const hasToolCalls = step.toolCalls && step.toolCalls.length > 0;

    return {
      message: {
        role: "assistant",
        content: step.content,
        toolCalls: step.toolCalls,
      },
      stopReason: hasToolCalls ? "tool_use" : "end_turn",
      usage: {
        inputTokens: messages.reduce((sum, m) => sum + m.content.length, 0),
        outputTokens: step.content.length,
      },
    };
  }
}
