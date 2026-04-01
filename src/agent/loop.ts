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
import { EventBus, createEvent } from "../runtime/event-bus.js";

export interface LoopOptions {
  maxSteps: number;
  toolExecutor?: ToolExecutor;
  eventBus?: EventBus;
  runId?: string;
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
  const { maxSteps, toolExecutor = noOpToolExecutor, eventBus, runId = "unknown" } = options;
  const steps: StepRecord[] = [];
  let finalOutput = "";
  let stopReason: StopReason = "max_steps";

  const emit = (type: Parameters<typeof createEvent>[0], data: Record<string, unknown> = {}) => {
    if (eventBus) eventBus.emit(createEvent(type, runId, data));
  };

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

    emit("step:think", {
      step,
      content: response.message.content?.slice(0, 200),
      hasToolCalls,
      usage: response.usage,
    });

    if (response.message.content) {
      console.log(`[Loop]   thought: ${response.message.content.slice(0, 120)}`);
    }

    // === No tool calls → complete ===
    if (!hasToolCalls) {
      steps.push(thinkRecord);
      finalOutput = response.message.content;
      stopReason = "complete";
      console.log(`[Loop]   → complete (no tool calls)`);
      break;
    }

    // === ACT: Execute each tool call ===
    console.log(`[Loop]   → act: ${response.message.toolCalls!.map(tc => tc.name).join(", ")}`);
    steps.push(thinkRecord);

    emit("step:act", {
      step,
      toolCalls: response.message.toolCalls!.map(tc => ({ name: tc.name, arguments: tc.arguments })),
    });

    const toolResults: ToolResult[] = [];
    for (const toolCall of response.message.toolCalls!) {
      console.log(`[Loop]   executing: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);

      emit("tool:call", { step, tool: toolCall.name, arguments: toolCall.arguments });

      const result = await toolExecutor(toolCall);
      toolResults.push(result);

      // Feed tool result back as a message
      messages.push({
        role: "tool",
        content: result.result,
        toolCallId: toolCall.id,
      });

      emit("tool:result", {
        step,
        tool: toolCall.name,
        result: result.result.slice(0, 500),
        isError: result.isError,
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

    emit("step:observe", {
      step,
      resultCount: toolResults.length,
      errors: toolResults.filter(r => r.isError).length,
    });

    console.log(`[Loop]   → observe: ${toolResults.length} result(s)`);

    // Check if finalize was called
    const finalizeResult = toolResults.find(r => r.name === FINALIZE_TOOL_NAME && !r.isError);
    if (finalizeResult) {
      finalOutput = finalizeResult.result;
      stopReason = "complete";
      emit("loop:finalize", { step, result: finalizeResult.result.slice(0, 500) });
      console.log(`[Loop]   → finalized`);
      break;
    }
  }

  if (stopReason === "max_steps") {
    console.log(`[Loop] Max steps (${maxSteps}) reached`);
    const lastAssistant = messages.filter(m => m.role === "assistant").pop();
    finalOutput = lastAssistant?.content ?? "Max steps reached without completion.";
  }

  return { steps, finalOutput, stopReason };
}
