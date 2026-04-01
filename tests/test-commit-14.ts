import { SharedContext, createHandoff } from "../src/runtime/shared-context.js";

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

  console.log("\n=== Commit 14 Tests — Multi-Agent Shared Memory Foundation ===\n");

  // Test 1: Key-value shared state
  console.log("Test 1: Shared state — set/get/has/keys");
  const ctx = new SharedContext();
  ctx.set("plan", "Build a REST API");
  ctx.set("phase", "planning");
  ctx.set("config", { port: 3000 });
  assert("get string", ctx.get("plan") === "Build a REST API");
  assert("get object", (ctx.get<{ port: number }>("config"))?.port === 3000);
  assert("has returns true", ctx.has("plan"));
  assert("has returns false", !ctx.has("nope"));
  assert("keys returns 3", ctx.keys().length === 3);

  // Test 2: Get undefined key
  console.log("\nTest 2: Get undefined key");
  assert("returns undefined", ctx.get("missing") === undefined);

  // Test 3: Agent logs
  console.log("\nTest 3: Per-agent logs");
  ctx.logAgentRun({
    agentId: "planner",
    runId: "run_1",
    taskDescription: "Create plan",
    result: { success: true, output: "Plan created", totalSteps: 2, runId: "run_1", taskId: "t1", duration: 100 },
    timestamp: new Date().toISOString(),
  });
  ctx.logAgentRun({
    agentId: "executor",
    runId: "run_2",
    taskDescription: "Execute step 1",
    result: { success: true, output: "Done", totalSteps: 3, runId: "run_2", taskId: "t2", duration: 200 },
    timestamp: new Date().toISOString(),
  });
  ctx.logAgentRun({
    agentId: "planner",
    runId: "run_3",
    taskDescription: "Refine plan",
    result: { success: false, output: "Error", totalSteps: 1, runId: "run_3", taskId: "t3", duration: 50 },
    timestamp: new Date().toISOString(),
  });

  const allLogs = ctx.getAgentLogs();
  assert("total 3 logs", allLogs.length === 3);

  const plannerLogs = ctx.getAgentLogs("planner");
  assert("planner has 2 logs", plannerLogs.length === 2);

  const executorLogs = ctx.getAgentLogs("executor");
  assert("executor has 1 log", executorLogs.length === 1);

  // Test 4: Handoff envelopes
  console.log("\nTest 4: Handoff envelopes");
  const h1 = createHandoff("planner", "executor", "Here's the plan", { steps: 3 });
  ctx.sendHandoff(h1);
  assert("handoff has fromAgent", h1.fromAgent === "planner");
  assert("handoff has toAgent", h1.toAgent === "executor");
  assert("handoff has data", h1.data?.steps === 3);
  assert("handoff has timestamp", h1.timestamp.length > 0);

  ctx.sendHandoff(createHandoff("executor", "reviewer", "Step 1 done"));
  ctx.sendHandoff(createHandoff("planner", "executor", "Updated plan"));

  const executorHandoffs = ctx.receiveHandoffs("executor");
  assert("executor has 2 handoffs", executorHandoffs.length === 2);

  const reviewerHandoffs = ctx.receiveHandoffs("reviewer");
  assert("reviewer has 1 handoff", reviewerHandoffs.length === 1);

  const allHandoffs = ctx.getAllHandoffs();
  assert("total 3 handoffs", allHandoffs.length === 3);

  // Test 5: No handoffs for unknown agent
  console.log("\nTest 5: No handoffs for unknown agent");
  const noHandoffs = ctx.receiveHandoffs("unknown_agent");
  assert("returns empty array", noHandoffs.length === 0);

  // Test 6: toSummary
  console.log("\nTest 6: toSummary");
  const summary = ctx.toSummary();
  assert("contains Shared State", summary.includes("## Shared State"));
  assert("contains plan key", summary.includes("plan:"));
  assert("contains Agent Run History", summary.includes("## Agent Run History"));
  assert("contains planner log", summary.includes("planner:"));
  assert("contains success marker", summary.includes("✓"));
  assert("contains failure marker", summary.includes("✗"));
  assert("contains Handoffs", summary.includes("## Handoffs"));
  assert("contains handoff flow", summary.includes("planner → executor"));

  // Test 7: Empty context summary
  console.log("\nTest 7: Empty context summary");
  const emptyCtx = new SharedContext();
  const emptySummary = emptyCtx.toSummary();
  assert("empty summary is empty string", emptySummary === "");

  // Test 8: Overwrite shared state
  console.log("\nTest 8: Overwrite shared state");
  ctx.set("phase", "execution");
  assert("updated value", ctx.get("phase") === "execution");
  assert("keys count unchanged", ctx.keys().length === 3);

  // Test 9: Complex data in shared state
  console.log("\nTest 9: Complex data types");
  ctx.set("results", [1, 2, 3]);
  ctx.set("flag", true);
  ctx.set("count", 42);
  assert("array stored", (ctx.get<number[]>("results"))?.length === 3);
  assert("boolean stored", ctx.get("flag") === true);
  assert("number stored", ctx.get("count") === 42);

  // Test 10: Summary truncates long values
  console.log("\nTest 10: Summary truncates long values");
  ctx.set("longValue", "A".repeat(200));
  const longSummary = ctx.toSummary();
  assert("truncated with ellipsis", longSummary.includes("..."));

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
