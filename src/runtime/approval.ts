import { ToolCall, ToolResult } from "../core/types.js";

export type ApprovalDecision = "approve" | "deny" | "modify";

export interface ApprovalRequest {
  toolCall: ToolCall;
  reason: string;
  runId: string;
  step: number;
}

export interface ApprovalResponse {
  decision: ApprovalDecision;
  modifiedArguments?: Record<string, unknown>;
  message?: string;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<ApprovalResponse>;

export interface ApprovalGateConfig {
  dangerousTools: string[];
  handler: ApprovalHandler;
}

export function createApprovalGate(config: ApprovalGateConfig) {
  const { dangerousTools, handler } = config;

  return {
    requiresApproval(toolCall: ToolCall): boolean {
      return dangerousTools.includes(toolCall.name);
    },

    async checkApproval(
      toolCall: ToolCall,
      runId: string,
      step: number
    ): Promise<{ approved: boolean; modifiedCall?: ToolCall; message?: string }> {
      if (!dangerousTools.includes(toolCall.name)) {
        return { approved: true };
      }

      const request: ApprovalRequest = {
        toolCall,
        reason: `Tool "${toolCall.name}" requires approval before execution.`,
        runId,
        step,
      };

      const response = await handler(request);

      switch (response.decision) {
        case "approve":
          return { approved: true };
        case "modify":
          return {
            approved: true,
            modifiedCall: {
              ...toolCall,
              arguments: response.modifiedArguments ?? toolCall.arguments,
            },
          };
        case "deny":
          return { approved: false, message: response.message ?? "Approval denied." };
      }
    },
  };
}

export type ApprovalGate = ReturnType<typeof createApprovalGate>;

// Auto-approve handler for testing
export function autoApproveHandler(): ApprovalHandler {
  return async () => ({ decision: "approve" });
}

// Auto-deny handler for testing
export function autoDenyHandler(message = "Denied by policy."): ApprovalHandler {
  return async () => ({ decision: "deny", message });
}

// Creates a tool executor that wraps another executor with approval checks
export function withApprovalGate(
  executor: (call: ToolCall) => Promise<ToolResult>,
  gate: ApprovalGate,
  runId: string,
  step: number
): (call: ToolCall) => Promise<ToolResult> {
  return async (call: ToolCall): Promise<ToolResult> => {
    const check = await gate.checkApproval(call, runId, step);

    if (!check.approved) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: `Approval denied: ${check.message}`,
        isError: true,
      };
    }

    const actualCall = check.modifiedCall ?? call;
    return executor(actualCall);
  };
}
