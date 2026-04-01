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

// --- Step & Loop types ---

export type StepPhase = "think" | "act" | "observe";

export interface StepRecord {
  stepNumber: number;
  phase: StepPhase;
  input: Message[];
  output: LLMResponse;
  toolResults?: ToolResult[];
  timestamp: string;
}

export type StopReason =
  | "complete"        // LLM returned end_turn with no tool calls
  | "max_steps"       // hit the step limit
  | "error"           // unrecoverable error
  | "tool_error";     // tool execution failed and loop was halted

export type ToolExecutor = (call: ToolCall) => Promise<ToolResult>;
