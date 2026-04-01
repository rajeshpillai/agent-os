import { Agent } from "../src/agent/agent.js";
import { MockProvider } from "../src/llm/providers/mock.provider.js";
import { createTask } from "../src/core/task.js";

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

  console.log("\n=== Commit 01 Tests ===\n");

  // Test 1: Default mock completes successfully
  console.log("Test 1: Default mock run");
  const agent1 = new Agent(new MockProvider(), { maxSteps: 5 });
  const r1 = await agent1.execute(createTask("Simple task"));
  assert("should succeed", r1.success);
  assert("should complete in 1 step", r1.totalSteps === 1);
  assert("should have output", r1.output.length > 0);

  // Test 2: Custom multi-response mock
  console.log("\nTest 2: Custom mock responses");
  const agent2 = new Agent(
    new MockProvider(["Thinking...", "Done."]),
    { maxSteps: 5 }
  );
  const r2 = await agent2.execute(createTask("Multi-step task"));
  assert("should succeed", r2.success);
  assert("should have run and task IDs", r2.runId.startsWith("run_") && r2.taskId.startsWith("task_"));

  // Test 3: Task creation
  console.log("\nTest 3: Task creation");
  const task = createTask("Test task", "some input");
  assert("should have an id", task.id.startsWith("task_"));
  assert("should store description", task.description === "Test task");
  assert("should store input", task.input === "some input");
  assert("should have createdAt", task.createdAt.length > 0);

  // Test 4: Config loading
  console.log("\nTest 4: Config defaults");
  const { loadConfig } = await import("../src/config/env.js");
  const config = loadConfig();
  assert("default provider is mock", config.llmProvider === "mock");
  assert("default max steps is 10", config.maxSteps === 10);

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
