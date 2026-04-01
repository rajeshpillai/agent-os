import { ToolCall, ToolResult } from "../core/types.js";

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface Tool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

export async function executeTool(tool: Tool, call: ToolCall): Promise<ToolResult> {
  try {
    const result = await tool.execute(call.arguments);
    return {
      toolCallId: call.id,
      name: call.name,
      result,
      isError: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      toolCallId: call.id,
      name: call.name,
      result: `Error: ${message}`,
      isError: true,
    };
  }
}
