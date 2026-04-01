import { LLMProvider, LLMResponse, Message } from "../../core/types.js";

export class MockProvider implements LLMProvider {
  private callCount = 0;
  private responses: string[];

  constructor(responses?: string[]) {
    this.responses = responses ?? [
      "I'm analyzing the task. Let me think about this step by step.",
      "Based on my analysis, here is my conclusion:\n\nThe task has been completed successfully.",
    ];
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const responseIndex = Math.min(this.callCount, this.responses.length - 1);
    const content = this.responses[responseIndex];
    this.callCount++;

    const isLast = this.callCount >= this.responses.length;

    return {
      message: {
        role: "assistant",
        content,
      },
      stopReason: isLast ? "end_turn" : "end_turn",
      usage: {
        inputTokens: messages.reduce((sum, m) => sum + m.content.length, 0),
        outputTokens: content.length,
      },
    };
  }
}
