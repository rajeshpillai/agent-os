// Core domain types for Agent OS

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  isError: boolean;
}

export interface LLMResponse {
  message: Message;
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProvider {
  chat(messages: Message[]): Promise<LLMResponse>;
}

export interface StepRecord {
  stepNumber: number;
  input: Message[];
  output: LLMResponse;
  toolResults?: ToolResult[];
  timestamp: string;
}
