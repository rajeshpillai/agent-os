import { rmSync } from "node:fs";
import { summarizeRun, formatSummary, summarizeAndSave, compressMemoryEntries } from "../src/memory/summary.js";
import { createTask } from "../src/core/task.js";
import { createRun, completeRun, failRun } from "../src/core/run.js";
import { StepRecord, LLMResponse } from "../src/core/types.js";
import { FileMemoryStore } from "../src/memory/file-memory-store.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
import { createReadFileTool } from "../src/tools/builtins/read-file.tool.js";

const TEST_DIR = "/tmp/agent-os-test-11";

function makeLLMResponse(content: string): LLMResponse {
  return {
    message: { role: "assistant", content },
    stopReason: "end_turn",
  };
}

function makeStep(step: number, toolNames: string[] = []): StepRecord {
  return {
    stepNumber: step,
    phase: toolNames.length ? "observe" : "think",
    input: [],
    output: {
      message: {
        role: "assistant",
        content: "thinking",
        toolCalls: toolNames.map((name, i) => ({ id: `c${i}`, name, arguments: {} })),
      },
      stopReason: toolNames.length ? "tool_use" : "end_turn",
    },
    toolResults: toolNames.map((name, i) => ({
      toolCallId: `c${i}`,
      name,
      result: "ok",
      isError: false,
    })),
    timestamp: new Date().toISOString(),
  };
}

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

  rmSync(TEST_DIR, { recursive: true, force: true });

  console.log("\n=== Commit 11 Tests — Summarization + Memory Compression ===\n");

  // Test 1: summarizeRun — completed run
  console.log("Test 1: Summarize completed run");
  const task = createTask("Build a REST API");
  let run = createRun(task);
  run.steps = [makeStep(1, ["read_file", "list_files"]), makeStep(2, ["write_file"]), makeStep(3)];
  run = completeRun(run, "API built with 3 endpoints.");

  const summary = summarizeRun(task, run);
  assert("taskId matches", summary.taskId === task.id);
  assert("status is completed", summary.status === "completed");
  assert("totalSteps is 3", summary.totalSteps === 3);
  assert("tools include read_file", summary.toolsUsed.includes("read_file"));
  assert("tools include write_file", summary.toolsUsed.includes("write_file"));
  assert("tools include list_files", summary.toolsUsed.includes("list_files"));
  assert("result captured", summary.result === "API built with 3 endpoints.");

  // Test 2: summarizeRun — failed run
  console.log("\nTest 2: Summarize failed run");
  const failedTask = createTask("Deploy to prod");
  let failedRun = createRun(failedTask);
  failedRun = failRun(failedRun, "Connection refused");
  const failedSummary = summarizeRun(failedTask, failedRun);
  assert("status is failed", failedSummary.status === "failed");
  assert("error captured", failedSummary.error === "Connection refused");
  assert("no tools used", failedSummary.toolsUsed.length === 0);

  // Test 3: formatSummary
  console.log("\nTest 3: Format summary");
  const formatted = formatSummary(summary);
  assert("contains task description", formatted.includes("Build a REST API"));
  assert("contains status", formatted.includes("completed"));
  assert("contains tools", formatted.includes("read_file"));
  assert("contains result", formatted.includes("API built with 3 endpoints"));

  // Test 4: formatSummary truncates long results
  console.log("\nTest 4: Format summary truncates long results");
  const longSummary = { ...summary, result: "A".repeat(500) };
  const longFormatted = formatSummary(longSummary);
  assert("truncated with ellipsis", longFormatted.includes("..."));
  assert("not full 500 chars", longFormatted.length < 500);

  // Test 5: summarizeAndSave
  console.log("\nTest 5: Summarize and save to store");
  const store = new FileMemoryStore(`${TEST_DIR}/memory`);
  await summarizeAndSave(store, task, run);
  const summaries = await store.query({ type: "summary", taskId: task.id });
  assert("summary saved to store", summaries.length === 1);
  assert("summary content has task description", summaries[0].content.includes("Build a REST API"));

  // Test 6: compressMemoryEntries — fits budget
  console.log("\nTest 6: Compress memory — fits budget");
  const entries = [
    { content: "Short entry 1" },
    { content: "Short entry 2" },
    { content: "Short entry 3" },
  ];
  const compressed = compressMemoryEntries(entries, 1000);
  assert("all 3 entries fit", compressed.length === 3);

  // Test 7: compressMemoryEntries — exceeds budget
  console.log("\nTest 7: Compress memory — exceeds budget");
  const bigEntries = [
    { content: "A".repeat(100) },
    { content: "B".repeat(100) },
    { content: "C".repeat(100) },
  ];
  const limited = compressMemoryEntries(bigEntries, 180);
  assert("only first fits fully", limited.length === 2);
  assert("second is truncated", limited[1].endsWith("..."));

  // Test 8: compressMemoryEntries — empty
  console.log("\nTest 8: Compress memory — empty input");
  const emptyCompressed = compressMemoryEntries([], 1000);
  assert("returns empty array", emptyCompressed.length === 0);

  // Test 9: compressMemoryEntries — tiny budget
  console.log("\nTest 9: Compress memory — tiny budget skips short entries");
  const tinyCompressed = compressMemoryEntries(bigEntries, 30);
  assert("nothing fits (budget < 50 remaining)", tinyCompressed.length === 0);

  // Test 10: Agent auto-summarizes on completion
  console.log("\nTest 10: Agent auto-summarizes completed runs");
  const agentStore = new FileMemoryStore(`${TEST_DIR}/agent-memory`);
  const reg = new ToolRegistry();
  reg.register(createFinalizeTool());
  reg.register(createReadFileTool("."));

  const steps: (string | MockStep)[] = [
    {
      content: "Reading file.",
      toolCalls: [{ id: "t1", name: "read_file", arguments: { path: "README.md" } }],
    },
    {
      content: "Done.",
      toolCalls: [{ id: "t2", name: "finalize", arguments: { result: "README summarized." } }],
    },
  ];
  const agent = new Agent(new MockProvider(steps), {
    maxSteps: 5,
    registry: reg,
    memoryStore: agentStore,
  });
  const result = await agent.execute(createTask("Summarize README"));
  assert("agent succeeds", result.success);

  const agentSummaries = await agentStore.query({ type: "summary" });
  assert("summary auto-saved", agentSummaries.length === 1);
  assert("summary mentions tools", agentSummaries[0].content.includes("read_file"));

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
