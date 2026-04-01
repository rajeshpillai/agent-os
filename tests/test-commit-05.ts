import { rmSync } from "node:fs";
import { FileMemoryStore } from "../src/memory/file-memory-store.js";
import { MemoryEntry } from "../src/memory/memory-store.js";
import { saveTaskMemory, saveRunMemory, saveSummary, getTaskHistory, getRecentMemory } from "../src/memory/helpers.js";
import { createTask } from "../src/core/task.js";
import { createRun, completeRun } from "../src/core/run.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider } from "../src/llm/providers/mock.provider.js";

const TEST_DIR = "/tmp/agent-os-test-05-memory";

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

  // Clean slate
  rmSync(TEST_DIR, { recursive: true, force: true });

  console.log("\n=== Commit 05 Tests — File-based Memory ===\n");

  // Test 1: Store creation — directories exist
  console.log("Test 1: Store initialization creates directories");
  const store = new FileMemoryStore(TEST_DIR);
  const { existsSync } = await import("node:fs");
  assert("tasks dir exists", existsSync(`${TEST_DIR}/tasks`));
  assert("runs dir exists", existsSync(`${TEST_DIR}/runs`));
  assert("summaries dir exists", existsSync(`${TEST_DIR}/summaries`));
  assert("facts dir exists", existsSync(`${TEST_DIR}/facts`));

  // Test 2: Save and load
  console.log("\nTest 2: Save and load entry");
  const entry: MemoryEntry = {
    id: "test_entry_1",
    type: "fact",
    content: "Agent OS is a runtime for LLM agents.",
    createdAt: new Date().toISOString(),
  };
  await store.save(entry);
  const loaded = await store.load("test_entry_1");
  assert("loaded entry exists", loaded !== null);
  assert("content matches", loaded!.content === entry.content);
  assert("type matches", loaded!.type === "fact");

  // Test 3: Load nonexistent
  console.log("\nTest 3: Load nonexistent entry");
  const missing = await store.load("does_not_exist");
  assert("returns null", missing === null);

  // Test 4: Query by type
  console.log("\nTest 4: Query by type");
  const entry2: MemoryEntry = {
    id: "test_entry_2",
    type: "fact",
    content: "Another fact.",
    createdAt: new Date().toISOString(),
  };
  await store.save(entry2);
  const facts = await store.query({ type: "fact" });
  assert("finds 2 facts", facts.length === 2);
  const runs = await store.query({ type: "run" });
  assert("finds 0 runs", runs.length === 0);

  // Test 5: Query by taskId
  console.log("\nTest 5: Query by taskId");
  const taskEntry: MemoryEntry = {
    id: "task_abc",
    type: "task",
    content: "Task ABC",
    metadata: { taskId: "task_abc" },
    createdAt: new Date().toISOString(),
  };
  const runEntry: MemoryEntry = {
    id: "run_abc_1",
    type: "run",
    content: "Run for ABC",
    metadata: { taskId: "task_abc" },
    createdAt: new Date().toISOString(),
  };
  await store.save(taskEntry);
  await store.save(runEntry);
  const taskHistory = await store.query({ taskId: "task_abc" });
  assert("finds 2 entries for task_abc", taskHistory.length === 2);

  // Test 6: Query with limit
  console.log("\nTest 6: Query with limit");
  const all = await store.list();
  assert("total entries > 2", all.length > 2);
  const limited = await store.query({ limit: 2 });
  assert("limit returns 2", limited.length === 2);

  // Test 7: Delete
  console.log("\nTest 7: Delete entry");
  const deleted = await store.delete("test_entry_1");
  assert("delete returns true", deleted);
  const afterDelete = await store.load("test_entry_1");
  assert("entry is gone", afterDelete === null);
  const deleteMissing = await store.delete("nope");
  assert("delete nonexistent returns false", !deleteMissing);

  // Test 8: Helper — saveTaskMemory
  console.log("\nTest 8: saveTaskMemory helper");
  const task = createTask("Build a REST API", "Express + TypeScript");
  await saveTaskMemory(store, task);
  const savedTask = await store.load(task.id);
  assert("task saved", savedTask !== null);
  assert("task content includes description", savedTask!.content.includes("Build a REST API"));
  assert("task content includes input", savedTask!.content.includes("Express + TypeScript"));

  // Test 9: Helper — saveRunMemory
  console.log("\nTest 9: saveRunMemory helper");
  let run = createRun(task);
  run = completeRun(run, "API created successfully");
  await saveRunMemory(store, run);
  const savedRun = await store.load(run.id);
  assert("run saved", savedRun !== null);
  assert("run content includes status", savedRun!.content.includes("completed"));

  // Test 10: Helper — saveSummary
  console.log("\nTest 10: saveSummary helper");
  await saveSummary(store, task.id, "Built a REST API with 3 endpoints.");
  const summaries = await store.query({ type: "summary", taskId: task.id });
  assert("summary saved", summaries.length === 1);
  assert("summary content matches", summaries[0].content === "Built a REST API with 3 endpoints.");

  // Test 11: Helper — getTaskHistory
  console.log("\nTest 11: getTaskHistory helper");
  const history = await getTaskHistory(store, task.id);
  assert("finds task + run + summary", history.length === 3);

  // Test 12: Helper — getRecentMemory
  console.log("\nTest 12: getRecentMemory helper");
  const recent = await getRecentMemory(store, 3);
  assert("returns at most 3", recent.length === 3);

  // Test 13: Agent integration — auto-persists to memory
  console.log("\nTest 13: Agent auto-persists task and run to memory");
  const agentStore = new FileMemoryStore(`${TEST_DIR}/agent-run`);
  const agent = new Agent(new MockProvider(["The answer is 42."]), {
    maxSteps: 5,
    memoryStore: agentStore,
  });
  const agentTask = createTask("What is 6 * 7?");
  const result = await agent.execute(agentTask);
  assert("agent succeeds", result.success);
  const persistedTask = await agentStore.load(agentTask.id);
  assert("task persisted by agent", persistedTask !== null);
  const persistedRuns = await agentStore.query({ type: "run", taskId: agentTask.id });
  assert("run persisted by agent", persistedRuns.length === 1);

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
