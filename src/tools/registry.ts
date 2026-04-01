import { ToolCall, ToolResult } from "../core/types.js";
import { Tool, ToolDefinition, executeTool } from "./tool.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`Tool "${tool.definition.name}" is already registered.`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        result: `Error: tool "${call.name}" is not registered.`,
        isError: true,
      };
    }
    return executeTool(tool, call);
  }

  toExecutor(): (call: ToolCall) => Promise<ToolResult> {
    return (call) => this.execute(call);
  }
}
