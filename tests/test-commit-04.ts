import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { Agent } from "../src/agent/agent.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { createTask } from "../src/core/task.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
import { createListFilesTool } from "../src/tools/builtins/list-files.tool.js";
import { createReadFileTool } from "../src/tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "../src/tools/builtins/write-file.tool.js";
import { resolveSafePath } from "../src/storage/paths.js";

const TEST_DIR = "/tmp/agent-os-test-04";

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

  // Setup test workspace
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(`${TEST_DIR}/hello.txt`, "Hello, Agent OS!");
  mkdirSync(`${TEST_DIR}/subdir`);
  writeFileSync(`${TEST_DIR}/subdir/nested.txt`, "Nested content");

  console.log("\n=== Commit 04 Tests — Workspace Tools ===\n");

  // Test 1: resolveSafePath — valid paths
  console.log("Test 1: Safe path resolver — valid paths");
  const resolved = resolveSafePath(TEST_DIR, "hello.txt");
  assert("resolves to full path", resolved.endsWith("hello.txt"));
  const resolvedNested = resolveSafePath(TEST_DIR, "subdir/nested.txt");
  assert("resolves nested path", resolvedNested.includes("subdir/nested.txt"));

  // Test 2: resolveSafePath — escape attempt
  console.log("\nTest 2: Safe path resolver — boundary check");
  let threw = false;
  try {
    resolveSafePath(TEST_DIR, "../../etc/passwd");
  } catch {
    threw = true;
  }
  assert("blocks path traversal", threw);

  // Test 3: read_file tool
  console.log("\nTest 3: read_file tool");
  const reg = new ToolRegistry();
  reg.register(createReadFileTool(TEST_DIR));
  reg.register(createWriteFileTool(TEST_DIR));
  reg.register(createListFilesTool(TEST_DIR));
  reg.register(createFinalizeTool());

  const readResult = await reg.execute({
    id: "r1", name: "read_file", arguments: { path: "hello.txt" },
  });
  assert("read succeeds", !readResult.isError);
  assert("content matches", readResult.result === "Hello, Agent OS!");

  // Test 4: read_file — nested path
  console.log("\nTest 4: read_file — nested path");
  const readNested = await reg.execute({
    id: "r2", name: "read_file", arguments: { path: "subdir/nested.txt" },
  });
  assert("read nested succeeds", !readNested.isError);
  assert("nested content matches", readNested.result === "Nested content");

  // Test 5: read_file — nonexistent file
  console.log("\nTest 5: read_file — nonexistent file");
  const readMissing = await reg.execute({
    id: "r3", name: "read_file", arguments: { path: "nope.txt" },
  });
  assert("returns error", readMissing.isError);

  // Test 6: read_file — path escape
  console.log("\nTest 6: read_file — path escape blocked");
  const readEscape = await reg.execute({
    id: "r4", name: "read_file", arguments: { path: "../../etc/passwd" },
  });
  assert("returns error", readEscape.isError);
  assert("mentions boundary", readEscape.result.includes("outside the workspace"));

  // Test 7: write_file tool
  console.log("\nTest 7: write_file tool");
  const writeResult = await reg.execute({
    id: "w1", name: "write_file", arguments: { path: "output.txt", content: "Written by agent" },
  });
  assert("write succeeds", !writeResult.isError);
  assert("file exists on disk", existsSync(`${TEST_DIR}/output.txt`));
  assert("content correct", readFileSync(`${TEST_DIR}/output.txt`, "utf-8") === "Written by agent");

  // Test 8: write_file — creates parent dirs
  console.log("\nTest 8: write_file — creates parent directories");
  const writeNested = await reg.execute({
    id: "w2", name: "write_file", arguments: { path: "deep/nested/file.txt", content: "deep!" },
  });
  assert("write nested succeeds", !writeNested.isError);
  assert("nested file exists", existsSync(`${TEST_DIR}/deep/nested/file.txt`));
  assert("nested content correct", readFileSync(`${TEST_DIR}/deep/nested/file.txt`, "utf-8") === "deep!");

  // Test 9: write_file — path escape blocked
  console.log("\nTest 9: write_file — path escape blocked");
  const writeEscape = await reg.execute({
    id: "w3", name: "write_file", arguments: { path: "../../tmp/bad.txt", content: "nope" },
  });
  assert("returns error", writeEscape.isError);
  assert("mentions boundary", writeEscape.result.includes("outside the workspace"));

  // Test 10: Full agent integration — read, write, finalize
  console.log("\nTest 10: Agent integration — read → write → finalize");
  const steps: (string | MockStep)[] = [
    {
      content: "Reading the file.",
      toolCalls: [{ id: "t1", name: "read_file", arguments: { path: "hello.txt" } }],
    },
    {
      content: "Writing a summary.",
      toolCalls: [{ id: "t2", name: "write_file", arguments: { path: "summary.txt", content: "Project: Agent OS" } }],
    },
    {
      content: "Done.",
      toolCalls: [{ id: "t3", name: "finalize", arguments: { result: "Read hello.txt, wrote summary.txt." } }],
    },
  ];
  const agent = new Agent(new MockProvider(steps), { maxSteps: 10, registry: reg });
  const r = await agent.execute(createTask("Read and summarize"));
  assert("agent succeeds", r.success);
  assert("output from finalize", r.output === "Read hello.txt, wrote summary.txt.");
  assert("summary.txt was written", readFileSync(`${TEST_DIR}/summary.txt`, "utf-8") === "Project: Agent OS");

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
