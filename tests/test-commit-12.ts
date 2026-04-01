import { createPlan, parsePlanFromText, PlannerExecutor, Plan } from "../src/runtime/runner.js";
import { createTask } from "../src/core/task.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";

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

  console.log("\n=== Commit 12 Tests — Planner / Executor Split ===\n");

  // Test 1: createPlan
  console.log("Test 1: createPlan");
  const task = createTask("Build a login page");
  const plan = createPlan(task, ["Create HTML template", "Add CSS styles", "Add form validation"]);
  assert("has 3 steps", plan.steps.length === 3);
  assert("all pending", plan.steps.every(s => s.status === "pending"));
  assert("step 1 correct", plan.steps[0].description === "Create HTML template");
  assert("taskId matches", plan.taskId === task.id);

  // Test 2: parsePlanFromText — numbered list
  console.log("\nTest 2: Parse plan — numbered list");
  const numbered = parsePlanFromText("1. Read the requirements\n2. Write the code\n3. Run tests");
  assert("parses 3 steps", numbered.length === 3);
  assert("first step correct", numbered[0] === "Read the requirements");
  assert("last step correct", numbered[2] === "Run tests");

  // Test 3: parsePlanFromText — bulleted list
  console.log("\nTest 3: Parse plan — bulleted list");
  const bulleted = parsePlanFromText("- Analyze codebase\n- Implement feature\n- Verify");
  assert("parses 3 steps", bulleted.length === 3);
  assert("first step correct", bulleted[0] === "Analyze codebase");

  // Test 4: parsePlanFromText — mixed with other text
  console.log("\nTest 4: Parse plan — mixed content");
  const mixed = parsePlanFromText("Here's my plan:\n1. Step one\n2. Step two\nSome extra text\n3. Step three");
  assert("parses 3 steps (ignores non-list lines)", mixed.length === 3);

  // Test 5: parsePlanFromText — parenthesis numbering
  console.log("\nTest 5: Parse plan — parenthesis numbering");
  const parens = parsePlanFromText("1) First\n2) Second");
  assert("parses 2 steps", parens.length === 2);

  // Test 6: parsePlanFromText — empty/no steps
  console.log("\nTest 6: Parse plan — no steps found");
  const empty = parsePlanFromText("Just some text with no list.");
  assert("returns empty array", empty.length === 0);

  // Test 7: PlannerExecutor — plan phase
  console.log("\nTest 7: PlannerExecutor — plan phase");
  const plannerProvider = new MockProvider([
    "1. Read the file\n2. Analyze content\n3. Write summary",
  ]);
  const pe = new PlannerExecutor({
    provider: plannerProvider,
    agentOptions: {},
    plannerMaxSteps: 3,
    executorMaxSteps: 5,
  });
  const generatedPlan = await pe.plan(createTask("Summarize the project"));
  assert("plan has 3 steps", generatedPlan.steps.length === 3);
  assert("first step is Read the file", generatedPlan.steps[0].description === "Read the file");

  // Test 8: PlannerExecutor — execute phase
  console.log("\nTest 8: PlannerExecutor — execute plan");
  const executorProvider = new MockProvider([
    "Step completed: file read.",
    "Step completed: content analyzed.",
    "Step completed: summary written.",
  ]);
  const execPlan = createPlan(createTask("Do work"), ["Read", "Analyze", "Write"]);
  const pe2 = new PlannerExecutor({
    provider: executorProvider,
    agentOptions: {},
    executorMaxSteps: 3,
  });
  const { plan: executedPlan, results } = await pe2.execute(execPlan);
  assert("3 results returned", results.length === 3);
  assert("all succeeded", results.every(r => r.success));
  assert("step 1 completed", executedPlan.steps[0].status === "completed");
  assert("step 3 completed", executedPlan.steps[2].status === "completed");

  // Test 9: PlannerExecutor — handles step failure
  console.log("\nTest 9: PlannerExecutor — step failure");
  const failProvider = {
    callCount: 0,
    async chat() {
      this.callCount++;
      if (this.callCount === 2) throw new Error("API error");
      return {
        message: { role: "assistant" as const, content: "Done." },
        stopReason: "end_turn" as const,
      };
    },
  };
  const failPlan = createPlan(createTask("Risky work"), ["Step A", "Step B (will fail)", "Step C"]);
  const pe3 = new PlannerExecutor({
    provider: failProvider,
    agentOptions: {},
    executorMaxSteps: 2,
  });
  const { plan: failedPlan, results: failResults } = await pe3.execute(failPlan);
  assert("step A completed", failedPlan.steps[0].status === "completed");
  assert("step B failed", failedPlan.steps[1].status === "failed");
  assert("step C still attempted", failedPlan.steps[2].status === "completed");

  // Test 10: PlannerExecutor — skipped steps
  console.log("\nTest 10: Skipped steps");
  const skipPlan = createPlan(createTask("Work"), ["Step 1", "Step 2", "Step 3"]);
  skipPlan.steps[1].status = "skipped";
  const skipProvider = new MockProvider(["Done 1.", "Done 3."]);
  const pe4 = new PlannerExecutor({
    provider: skipProvider,
    agentOptions: {},
    executorMaxSteps: 2,
  });
  const { results: skipResults } = await pe4.execute(skipPlan);
  assert("only 2 results (skipped step 2)", skipResults.length === 2);

  // Test 11: PlannerExecutor — planAndExecute
  console.log("\nTest 11: Full planAndExecute");
  // Mock returns plan on first call, then results for each step
  const fullProvider = new MockProvider([
    "1. First thing\n2. Second thing",   // planner output
    "First thing done.",                   // executor step 1
    "Second thing done.",                  // executor step 2
  ]);
  const pe5 = new PlannerExecutor({
    provider: fullProvider,
    agentOptions: {},
    plannerMaxSteps: 2,
    executorMaxSteps: 2,
  });
  const fullResult = await pe5.planAndExecute(createTask("Do everything"));
  assert("plan has 2 steps", fullResult.plan.steps.length === 2);
  assert("2 results", fullResult.results.length === 2);
  assert("all completed", fullResult.plan.steps.every(s => s.status === "completed"));

  // Test 12: PlannerExecutor with registry
  console.log("\nTest 12: PlannerExecutor with tool registry");
  const reg = new ToolRegistry();
  reg.register(createFinalizeTool());
  const regSteps: (string | MockStep)[] = [
    "1. Finalize with answer",
    {
      content: "Done.",
      toolCalls: [{ id: "t1", name: "finalize", arguments: { result: "Plan step done." } }],
    },
  ];
  const pe6 = new PlannerExecutor({
    provider: new MockProvider(regSteps),
    agentOptions: { registry: reg },
    plannerMaxSteps: 2,
    executorMaxSteps: 3,
  });
  const regResult = await pe6.planAndExecute(createTask("Use tools"));
  assert("completed with registry", regResult.results[0].success);

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
