import { Agent } from "../src/agent/agent.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { createTask } from "../src/core/task.js";
import { ToolCall, ToolResult } from "../src/core/types.js";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }

  console.log("\n=== Commit 02 Tests — Agent Loop v1 ===\n");

  // Test 1: Simple completion (no tool calls)
  console.log("Test 1: Direct completion (think only)");
  const agent1 = new Agent(new MockProvider(["The answer is 42."]), { maxSteps: 5 });
  const r1 = await agent1.execute(createTask("What is the answer?"));
  assert("should succeed", r1.success);
  assert("should complete in 1 step (think)", r1.totalSteps === 1);
  assert("output matches", r1.output === "The answer is 42.");

  // Test 2: Think → Act → Observe → Think → Complete
  console.log("\nTest 2: Tool call loop (think → act → observe → complete)");
  const steps: (string | MockStep)[] = [
    {
      content: "I need to look this up.",
      toolCalls: [{ id: "call_1", name: "search", arguments: { q: "test" } }],
    },
    "Found it. The answer is 42.",
  ];
  const agent2 = new Agent(new MockProvider(steps), { maxSteps: 5 });
  const r2 = await agent2.execute(createTask("Search for something"));
  assert("should succeed", r2.success);
  // Steps: think+observe (from tool call) + think (final answer) = 3 records
  assert("should have 3 step records", r2.totalSteps === 3);
  assert("output is final answer", r2.output === "Found it. The answer is 42.");

  // Test 3: Max steps guard
  console.log("\nTest 3: Max steps reached");
  const infiniteToolSteps: MockStep[] = Array(10).fill({
    content: "Still working...",
    toolCalls: [{ id: "call_x", name: "work", arguments: {} }],
  });
  const agent3 = new Agent(new MockProvider(infiniteToolSteps), { maxSteps: 3 });
  const r3 = await agent3.execute(createTask("Infinite loop task"));
  assert("should not succeed", !r3.success);
  assert("should have hit max steps", r3.totalSteps === 6); // 3 iterations × 2 records each (think+observe)

  // Test 4: Custom tool executor
  console.log("\nTest 4: Custom tool executor");
  const toolSteps: (string | MockStep)[] = [
    {
      content: "Let me calculate.",
      toolCalls: [{ id: "call_add", name: "add", arguments: { a: 2, b: 3 } }],
    },
    "The sum is 5.",
  ];
  const executor = async (call: ToolCall): Promise<ToolResult> => ({
    toolCallId: call.id,
    name: call.name,
    result: String((call.arguments.a as number) + (call.arguments.b as number)),
    isError: false,
  });
  const agent4 = new Agent(new MockProvider(toolSteps), {
    maxSteps: 5,
    toolExecutor: executor,
  });
  const r4 = await agent4.execute(createTask("Add 2 + 3"));
  assert("should succeed", r4.success);
  assert("output is final answer", r4.output === "The sum is 5.");

  // Test 5: Error handling
  console.log("\nTest 5: Provider error handling");
  const badProvider = {
    async chat(): Promise<never> {
      throw new Error("API connection failed");
    },
  };
  const agent5 = new Agent(badProvider, { maxSteps: 5 });
  const r5 = await agent5.execute(createTask("This will fail"));
  assert("should not succeed", !r5.success);
  assert("output contains error", r5.output.includes("API connection failed"));

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
