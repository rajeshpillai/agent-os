import { rmSync, existsSync } from "node:fs";
import { EventBus, createEvent, AgentEvent, EventType } from "../src/runtime/event-bus.js";
import { RunLogger } from "../src/runtime/run-logger.js";
import { appendJsonl, readJsonl } from "../src/storage/jsonl.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider, MockStep } from "../src/llm/providers/mock.provider.js";
import { createTask } from "../src/core/task.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";

const TEST_DIR = "/tmp/agent-os-test-10";

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

  console.log("\n=== Commit 10 Tests — Run Events + Logs ===\n");

  // Test 1: EventBus — emit and receive
  console.log("Test 1: EventBus emit and receive");
  const bus = new EventBus();
  const received: AgentEvent[] = [];
  bus.on("run:start", (e) => received.push(e));
  bus.emit(createEvent("run:start", "run_1", { task: "test" }));
  assert("received 1 event", received.length === 1);
  assert("event type correct", received[0].type === "run:start");
  assert("event data correct", received[0].data.task === "test");
  assert("event has timestamp", received[0].timestamp.length > 0);

  // Test 2: EventBus — wildcard handler
  console.log("\nTest 2: EventBus wildcard handler");
  const allEvents: AgentEvent[] = [];
  bus.on("*", (e) => allEvents.push(e));
  bus.emit(createEvent("run:complete", "run_1", {}));
  bus.emit(createEvent("step:think", "run_1", {}));
  assert("wildcard received all events", allEvents.length === 2);

  // Test 3: EventBus — off removes handler
  console.log("\nTest 3: EventBus off removes handler");
  const counter = { count: 0 };
  const handler = () => { counter.count++; };
  const bus2 = new EventBus();
  bus2.on("run:start", handler);
  bus2.emit(createEvent("run:start", "r", {}));
  assert("handler called once", counter.count === 1);
  bus2.off("run:start", handler);
  bus2.emit(createEvent("run:start", "r", {}));
  assert("handler removed — still 1", counter.count === 1);

  // Test 4: JSONL — append and read
  console.log("\nTest 4: JSONL append and read");
  const jsonlPath = `${TEST_DIR}/test.jsonl`;
  appendJsonl(jsonlPath, { a: 1 });
  appendJsonl(jsonlPath, { b: 2 });
  appendJsonl(jsonlPath, { c: 3 });
  const records = readJsonl<{ a?: number; b?: number; c?: number }>(jsonlPath);
  assert("reads 3 records", records.length === 3);
  assert("first record correct", records[0].a === 1);
  assert("third record correct", records[2].c === 3);

  // Test 5: JSONL — read nonexistent file
  console.log("\nTest 5: JSONL read nonexistent");
  const empty = readJsonl("/tmp/does-not-exist.jsonl");
  assert("returns empty array", empty.length === 0);

  // Test 6: RunLogger — logs events to JSONL
  console.log("\nTest 6: RunLogger writes JSONL per run");
  const logsDir = `${TEST_DIR}/logs`;
  const logger = new RunLogger({ logsDir });
  const logBus = new EventBus();
  logger.attachTo(logBus);

  logBus.emit(createEvent("run:start", "run_abc", { task: "test" }));
  logBus.emit(createEvent("step:think", "run_abc", { step: 1 }));
  logBus.emit(createEvent("run:complete", "run_abc", { output: "done" }));

  const log = logger.getRunLog("run_abc");
  assert("log has 3 events", log.length === 3);
  assert("first is run:start", log[0].type === "run:start");
  assert("last is run:complete", log[2].type === "run:complete");
  assert("log file exists", existsSync(`${logsDir}/run_abc.jsonl`));

  // Test 7: RunLogger — separate files per run
  console.log("\nTest 7: Separate log files per run");
  logBus.emit(createEvent("run:start", "run_xyz", { task: "other" }));
  const logXyz = logger.getRunLog("run_xyz");
  const logAbc = logger.getRunLog("run_abc");
  assert("run_xyz has 1 event", logXyz.length === 1);
  assert("run_abc still has 3", logAbc.length === 3);

  // Test 8: Agent integration — events emitted during run
  console.log("\nTest 8: Agent emits events during run");
  const agentBus = new EventBus();
  const agentEvents: AgentEvent[] = [];
  agentBus.on("*", (e) => agentEvents.push(e));

  const agentLogger = new RunLogger({ logsDir: `${TEST_DIR}/agent-logs` });

  const reg = new ToolRegistry();
  reg.register(createFinalizeTool());

  const steps: (string | MockStep)[] = [
    {
      content: "Thinking...",
      toolCalls: [{ id: "t1", name: "finalize", arguments: { result: "Done!" } }],
    },
  ];
  const agent = new Agent(new MockProvider(steps), {
    maxSteps: 5,
    registry: reg,
    eventBus: agentBus,
    runLogger: agentLogger,
  });
  const result = await agent.execute(createTask("Test task"));
  assert("agent succeeds", result.success);

  // Check events were emitted
  const eventTypes = agentEvents.map(e => e.type);
  assert("has run:start", eventTypes.includes("run:start"));
  assert("has step:think", eventTypes.includes("step:think"));
  assert("has step:act", eventTypes.includes("step:act"));
  assert("has tool:call", eventTypes.includes("tool:call"));
  assert("has tool:result", eventTypes.includes("tool:result"));
  assert("has step:observe", eventTypes.includes("step:observe"));
  assert("has loop:finalize", eventTypes.includes("loop:finalize"));
  assert("has run:complete", eventTypes.includes("run:complete"));

  // Check JSONL log was written
  const agentLog = agentLogger.getRunLog(result.runId);
  assert("log file has events", agentLog.length > 0);
  assert("log matches emitted events", agentLog.length === agentEvents.length);

  // Test 9: Agent — max_steps event
  console.log("\nTest 9: Max steps event");
  const maxBus = new EventBus();
  const maxEvents: AgentEvent[] = [];
  maxBus.on("*", (e) => maxEvents.push(e));

  const infiniteSteps: MockStep[] = Array(5).fill({
    content: "Working...",
    toolCalls: [{ id: "tx", name: "unknown_tool", arguments: {} }],
  });
  const agent2 = new Agent(new MockProvider(infiniteSteps), {
    maxSteps: 2,
    eventBus: maxBus,
  });
  await agent2.execute(createTask("Infinite task"));
  const maxTypes = maxEvents.map(e => e.type);
  assert("has run:max_steps", maxTypes.includes("run:max_steps"));

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
