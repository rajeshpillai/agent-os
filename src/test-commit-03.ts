import { Agent } from "./agent/agent.js";
import { MockProvider, MockStep } from "./llm/providers/mock.provider.js";
import { createTask } from "./core/task.js";
import { ToolRegistry } from "./tools/registry.js";
import { createFinalizeTool } from "./tools/builtins/finalize.tool.js";
import { createListFilesTool } from "./tools/builtins/list-files.tool.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const TEST_DIR = "/tmp/agent-os-test-03";

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
  writeFileSync(`${TEST_DIR}/hello.txt`, "hello");
  mkdirSync(`${TEST_DIR}/subdir`);

  console.log("\n=== Commit 03 Tests — Tool Interface + Registry ===\n");

  // Test 1: Registry basics
  console.log("Test 1: Registry register, list, has, get");
  const reg = new ToolRegistry();
  reg.register(createFinalizeTool());
  reg.register(createListFilesTool(TEST_DIR));
  assert("has finalize", reg.has("finalize"));
  assert("has list_files", reg.has("list_files"));
  assert("lists 2 tools", reg.list().length === 2);
  assert("get returns tool", reg.get("finalize") !== undefined);
  assert("get unknown returns undefined", reg.get("nope") === undefined);

  // Test 2: Duplicate registration throws
  console.log("\nTest 2: Duplicate registration");
  let duplicateThrew = false;
  try {
    reg.register(createFinalizeTool());
  } catch {
    duplicateThrew = true;
  }
  assert("should throw on duplicate", duplicateThrew);

  // Test 3: Registry execute — known tool
  console.log("\nTest 3: Execute known tool");
  const listResult = await reg.execute({
    id: "c1",
    name: "list_files",
    arguments: { path: "." },
  });
  assert("not an error", !listResult.isError);
  assert("contains hello.txt", listResult.result.includes("hello.txt"));
  assert("contains subdir", listResult.result.includes("subdir"));

  // Test 4: Registry execute — unknown tool
  console.log("\nTest 4: Execute unknown tool");
  const unknownResult = await reg.execute({
    id: "c2",
    name: "nope",
    arguments: {},
  });
  assert("is an error", unknownResult.isError);
  assert("says not registered", unknownResult.result.includes("not registered"));

  // Test 5: Finalize tool
  console.log("\nTest 5: Finalize tool execution");
  const finResult = await reg.execute({
    id: "c3",
    name: "finalize",
    arguments: { result: "Task done!" },
  });
  assert("not an error", !finResult.isError);
  assert("result is passed value", finResult.result === "Task done!");

  // Test 6: list_files path boundary check
  console.log("\nTest 6: Path boundary safety");
  const escapeResult = await reg.execute({
    id: "c4",
    name: "list_files",
    arguments: { path: "../../etc" },
  });
  assert("is an error", escapeResult.isError);
  assert("mentions boundary", escapeResult.result.includes("outside the workspace"));

  // Test 7: Agent with registry + finalize stops loop
  console.log("\nTest 7: Agent with registry — finalize stops loop");
  const steps: (string | MockStep)[] = [
    {
      content: "Let me list files.",
      toolCalls: [{ id: "t1", name: "list_files", arguments: { path: "." } }],
    },
    {
      content: "Done.",
      toolCalls: [
        { id: "t2", name: "finalize", arguments: { result: "Found hello.txt and subdir." } },
      ],
    },
  ];
  const agent = new Agent(new MockProvider(steps), {
    maxSteps: 10,
    registry: reg,
  });
  const r = await agent.execute(createTask("List files"));
  assert("should succeed", r.success);
  assert("output from finalize", r.output === "Found hello.txt and subdir.");

  // Test 8: Tool definitions have correct shape
  console.log("\nTest 8: Tool definitions shape");
  const defs = reg.list();
  const finDef = defs.find(d => d.name === "finalize");
  const listDef = defs.find(d => d.name === "list_files");
  assert("finalize has description", !!finDef?.description);
  assert("finalize has parameters", finDef!.parameters.length > 0);
  assert("list_files has description", !!listDef?.description);
  assert("list_files has parameters", listDef!.parameters.length > 0);

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
