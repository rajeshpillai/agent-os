import {
  createApprovalGate,
  autoApproveHandler,
  autoDenyHandler,
  ApprovalRequest,
  ApprovalResponse,
} from "../src/runtime/approval.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { createTask } from "../src/core/task.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
import { createShellTool } from "../src/tools/builtins/shell.tool.js";
import { createReadFileTool } from "../src/tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "../src/tools/builtins/write-file.tool.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";

const TEST_DIR = "/tmp/agent-os-test-13";

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
  mkdirSync(TEST_DIR, { recursive: true });

  console.log("\n=== Commit 13 Tests — Human Approval Gates ===\n");

  // Test 1: Approval gate — requiresApproval
  console.log("Test 1: requiresApproval check");
  const gate = createApprovalGate({
    dangerousTools: ["shell", "write_file"],
    handler: autoApproveHandler(),
  });
  assert("shell requires approval", gate.requiresApproval({ id: "c1", name: "shell", arguments: {} }));
  assert("write_file requires approval", gate.requiresApproval({ id: "c2", name: "write_file", arguments: {} }));
  assert("read_file does not", !gate.requiresApproval({ id: "c3", name: "read_file", arguments: {} }));
  assert("finalize does not", !gate.requiresApproval({ id: "c4", name: "finalize", arguments: {} }));

  // Test 2: Auto-approve handler
  console.log("\nTest 2: Auto-approve handler");
  const approveGate = createApprovalGate({
    dangerousTools: ["shell"],
    handler: autoApproveHandler(),
  });
  const approveResult = await approveGate.checkApproval(
    { id: "c1", name: "shell", arguments: { command: "ls" } }, "run_1", 1
  );
  assert("approved", approveResult.approved);

  // Test 3: Auto-deny handler
  console.log("\nTest 3: Auto-deny handler");
  const denyGate = createApprovalGate({
    dangerousTools: ["shell"],
    handler: autoDenyHandler("Too dangerous"),
  });
  const denyResult = await denyGate.checkApproval(
    { id: "c1", name: "shell", arguments: { command: "rm -rf ." } }, "run_1", 1
  );
  assert("not approved", !denyResult.approved);
  assert("has deny message", denyResult.message === "Too dangerous");

  // Test 4: Non-dangerous tools skip approval
  console.log("\nTest 4: Non-dangerous tools bypass gate");
  const skipResult = await denyGate.checkApproval(
    { id: "c2", name: "read_file", arguments: { path: "test.txt" } }, "run_1", 1
  );
  assert("auto-approved", skipResult.approved);

  // Test 5: Modify handler
  console.log("\nTest 5: Modify handler changes arguments");
  const modifyGate = createApprovalGate({
    dangerousTools: ["write_file"],
    handler: async (req: ApprovalRequest): Promise<ApprovalResponse> => ({
      decision: "modify",
      modifiedArguments: { ...req.toolCall.arguments, path: "safe_output.txt" },
    }),
  });
  const modResult = await modifyGate.checkApproval(
    { id: "c1", name: "write_file", arguments: { path: "dangerous.txt", content: "data" } },
    "run_1", 1
  );
  assert("approved with modification", modResult.approved);
  assert("arguments modified", modResult.modifiedCall?.arguments.path === "safe_output.txt");

  // Test 6: Agent with approval gate — approve flow
  console.log("\nTest 6: Agent with approval gate — approved");
  const reg = new ToolRegistry();
  reg.register(createFinalizeTool());
  reg.register(createShellTool({ workspaceRoot: TEST_DIR }));
  reg.register(createReadFileTool(TEST_DIR));

  const approvedGate = createApprovalGate({
    dangerousTools: ["shell"],
    handler: autoApproveHandler(),
  });

  const steps: (string | MockStep)[] = [
    {
      content: "Running a shell command.",
      toolCalls: [{ id: "t1", name: "shell", arguments: { command: "echo approved" } }],
    },
    {
      content: "Done.",
      toolCalls: [{ id: "t2", name: "finalize", arguments: { result: "Shell ran successfully." } }],
    },
  ];
  const agent = new Agent(new MockProvider(steps), {
    maxSteps: 5,
    registry: reg,
    approvalGate: approvedGate,
  });
  const agentResult = await agent.execute(createTask("Run echo"));
  assert("agent succeeds", agentResult.success);
  assert("output correct", agentResult.output === "Shell ran successfully.");

  // Test 7: Agent with approval gate — deny flow
  console.log("\nTest 7: Agent with approval gate — denied");
  const deniedGate = createApprovalGate({
    dangerousTools: ["shell"],
    handler: autoDenyHandler("Not allowed in this environment"),
  });

  const denySteps: (string | MockStep)[] = [
    {
      content: "Trying shell.",
      toolCalls: [{ id: "t1", name: "shell", arguments: { command: "echo denied" } }],
    },
    "The shell was denied, so I'll just report that.",
  ];
  const denyAgent = new Agent(new MockProvider(denySteps), {
    maxSteps: 5,
    registry: reg,
    approvalGate: deniedGate,
  });
  const denyAgentResult = await denyAgent.execute(createTask("Try shell"));
  assert("agent still completes", denyAgentResult.success);
  // The agent gets the denial as a tool error and continues

  // Test 8: Approval gate with write_file — modify to safe path
  console.log("\nTest 8: Write file with modified path");
  const writeReg = new ToolRegistry();
  writeReg.register(createFinalizeTool());
  writeReg.register(createWriteFileTool(TEST_DIR));

  const writeModGate = createApprovalGate({
    dangerousTools: ["write_file"],
    handler: async (req) => ({
      decision: "modify" as const,
      modifiedArguments: { ...req.toolCall.arguments, path: "approved_output.txt" },
    }),
  });

  const writeSteps: (string | MockStep)[] = [
    {
      content: "Writing file.",
      toolCalls: [{ id: "t1", name: "write_file", arguments: { path: "original.txt", content: "hello" } }],
    },
    {
      content: "Done.",
      toolCalls: [{ id: "t2", name: "finalize", arguments: { result: "File written." } }],
    },
  ];
  const writeAgent = new Agent(new MockProvider(writeSteps), {
    maxSteps: 5,
    registry: writeReg,
    approvalGate: writeModGate,
  });
  await writeAgent.execute(createTask("Write a file"));
  assert("original.txt NOT created", !existsSync(`${TEST_DIR}/original.txt`));
  assert("approved_output.txt created", existsSync(`${TEST_DIR}/approved_output.txt`));
  assert("content correct", readFileSync(`${TEST_DIR}/approved_output.txt`, "utf-8") === "hello");

  // Test 9: Custom approval handler with logging
  console.log("\nTest 9: Custom handler receives correct request data");
  const requests: ApprovalRequest[] = [];
  const loggingGate = createApprovalGate({
    dangerousTools: ["shell"],
    handler: async (req) => {
      requests.push(req);
      return { decision: "approve" };
    },
  });

  await loggingGate.checkApproval(
    { id: "c1", name: "shell", arguments: { command: "whoami" } },
    "run_test", 3
  );
  assert("request has toolCall", requests[0].toolCall.name === "shell");
  assert("request has runId", requests[0].runId === "run_test");
  assert("request has step", requests[0].step === 3);
  assert("request has reason", requests[0].reason.includes("requires approval"));

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
