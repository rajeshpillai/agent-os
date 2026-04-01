import {
  LLMProvider,
  Message,
  StepRecord,
  ToolCall,
  ToolResult,
  ToolExecutor,
  StopReason,
} from "../core/types.js";
import { FINALIZE_TOOL_NAME } from "../tools/builtins/finalize.tool.js";

export interface LoopOptions {
  maxSteps: number;
  toolExecutor?: ToolExecutor;
}

export interface LoopResult {
  steps: StepRecord[];
  finalOutput: string;
  stopReason: StopReason;
}

// Default tool executor — returns an error saying no tools are available
async function noOpToolExecutor(call: ToolCall): Promise<ToolResult> {
  return {
    toolCallId: call.id,
    name: call.name,
    result: `Error: tool "${call.name}" is not registered.`,
    isError: true,
  };
}

export async function runLoop(
  provider: LLMProvider,
  messages: Message[],
  options: LoopOptions
): Promise<LoopResult> {
  const { maxSteps, toolExecutor = noOpToolExecutor } = options;
  const steps: StepRecord[] = [];
  let finalOutput = "";
  let stopReason: StopReason = "max_steps";

  for (let step = 1; step <= maxSteps; step++) {
    // === THINK: Ask the LLM what to do next ===
    console.log(`[Loop] Step ${step}/${maxSteps} — think`);
    const response = await provider.chat(messages);

    const hasToolCalls = response.message.toolCalls && response.message.toolCalls.length > 0;

    const thinkRecord: StepRecord = {
      stepNumber: step,
      phase: "think",
      input: [...messages],
      output: response,
      timestamp: new Date().toISOString(),
    };

    messages.push(response.message);

    if (response.message.content) {
      console.log(`[Loop]   thought: ${response.message.content.slice(0, 120)}`);
    }

    // === No tool calls → complete ===
    if (!hasToolCalls) {
      thinkRecord.phase = "think";
      steps.push(thinkRecord);
      finalOutput = response.message.content;
      stopReason = "complete";
      console.log(`[Loop]   → complete (no tool calls)`);
      break;
    }

    // === ACT: Execute each tool call ===
    console.log(`[Loop]   → act: ${response.message.toolCalls!.map(tc => tc.name).join(", ")}`);
    steps.push(thinkRecord);

    const toolResults: ToolResult[] = [];
    for (const toolCall of response.message.toolCalls!) {
      console.log(`[Loop]   executing: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
      const result = await toolExecutor(toolCall);
      toolResults.push(result);

      // Feed tool result back as a message
      messages.push({
        role: "tool",
        content: result.result,
        toolCallId: toolCall.id,
      });

      console.log(`[Loop]   result: ${result.result.slice(0, 100)}${result.isError ? " [ERROR]" : ""}`);
    }

    // === OBSERVE: Record the tool results ===
    const observeRecord: StepRecord = {
      stepNumber: step,
      phase: "observe",
      input: [],
      output: response,
      toolResults,
      timestamp: new Date().toISOString(),
    };
    steps.push(observeRecord);

    console.log(`[Loop]   → observe: ${toolResults.length} result(s)`);

    // Check if finalize was called
    const finalizeResult = toolResults.find(r => r.name === FINALIZE_TOOL_NAME && !r.isError);
    if (finalizeResult) {
      finalOutput = finalizeResult.result;
      stopReason = "complete";
      console.log(`[Loop]   → finalized`);
      break;
    }
  }

  if (stopReason === "max_steps") {
    console.log(`[Loop] Max steps (${maxSteps}) reached`);
    // Use last assistant message as output if we hit max steps
    const lastAssistant = messages.filter(m => m.role === "assistant").pop();
    finalOutput = lastAssistant?.content ?? "Max steps reached without completion.";
  }

  return { steps, finalOutput, stopReason };
}
