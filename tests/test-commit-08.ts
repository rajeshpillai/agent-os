import { rmSync } from "node:fs";
import { buildSystemPrompt } from "../src/agent/system-prompt.js";
import { buildContext } from "../src/agent/context-builder.js";
import { createTask } from "../src/core/task.js";
import { ToolDefinition } from "../src/tools/tool.js";
import { Skill } from "../src/skills/models.js";
import { MemoryEntry } from "../src/memory/memory-store.js";
import { FileMemoryStore } from "../src/memory/file-memory-store.js";
import { saveSummary } from "../src/memory/helpers.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider } from "../src/llm/providers/mock.provider.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
import { createReadFileTool } from "../src/tools/builtins/read-file.tool.js";

const TEST_DIR = "/tmp/agent-os-test-08";

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

  console.log("\n=== Commit 08 Tests — System Prompt Composer ===\n");

  // Test 1: Base prompt loads from file
  console.log("Test 1: Base prompt from file");
  const task = createTask("Do something");
  const ctx = buildContext({ task });
  const prompt = buildSystemPrompt(ctx);
  assert("contains Agent OS identity", prompt.includes("Agent OS"));
  assert("contains core behavior", prompt.includes("Core Behavior"));
  assert("contains task", prompt.includes("## Current Task"));
  assert("contains task description", prompt.includes("Do something"));

  // Test 2: Tool descriptions section
  console.log("\nTest 2: Tool descriptions in prompt");
  const tools: ToolDefinition[] = [
    {
      name: "read_file",
      description: "Read a file from the workspace",
      parameters: [
        { name: "path", type: "string", description: "File path", required: true },
      ],
    },
    {
      name: "write_file",
      description: "Write to a file",
      parameters: [
        { name: "path", type: "string", description: "File path", required: true },
        { name: "content", type: "string", description: "Content to write", required: true },
      ],
    },
  ];
  const ctxTools = buildContext({ task, tools });
  const promptTools = buildSystemPrompt(ctxTools);
  assert("contains Available Tools header", promptTools.includes("## Available Tools"));
  assert("contains read_file", promptTools.includes("**read_file**"));
  assert("contains write_file", promptTools.includes("**write_file**"));
  assert("shows required params", promptTools.includes("(required)"));

  // Test 3: Skills section
  console.log("\nTest 3: Skills in prompt");
  const skills: Skill[] = [
    {
      name: "coding",
      description: "Write code",
      instructions: "Follow best practices.",
      tags: ["code"],
      tools: ["read_file", "write_file"],
    },
  ];
  const ctxSkills = buildContext({ task, skills });
  const promptSkills = buildSystemPrompt(ctxSkills);
  assert("contains Active Skills header", promptSkills.includes("## Active Skills"));
  assert("contains coding skill", promptSkills.includes("### Skill: coding"));
  assert("contains instructions", promptSkills.includes("Follow best practices"));

  // Test 4: Memory context section
  console.log("\nTest 4: Memory context in prompt");
  const memory: MemoryEntry[] = [
    {
      id: "m1",
      type: "summary",
      content: "Previous task created a REST API with 3 endpoints.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "m2",
      type: "fact",
      content: "The project uses Express.js as the web framework.",
      createdAt: new Date().toISOString(),
    },
  ];
  const ctxMemory = buildContext({ task, memory });
  const promptMemory = buildSystemPrompt(ctxMemory);
  assert("contains Memory Context header", promptMemory.includes("## Memory Context"));
  assert("contains summary entry", promptMemory.includes("[summary]"));
  assert("contains fact entry", promptMemory.includes("[fact]"));
  assert("contains actual memory content", promptMemory.includes("REST API with 3 endpoints"));

  // Test 5: Long memory gets truncated
  console.log("\nTest 5: Long memory truncated");
  const longMemory: MemoryEntry[] = [
    {
      id: "m3",
      type: "run",
      content: "A".repeat(300),
      createdAt: new Date().toISOString(),
    },
  ];
  const ctxLong = buildContext({ task, memory: longMemory });
  const promptLong = buildSystemPrompt(ctxLong);
  assert("truncated with ellipsis", promptLong.includes("..."));

  // Test 6: Task envelope with input
  console.log("\nTest 6: Task envelope with input");
  const taskWithInput = createTask("Analyze this data", '{"users": 42}');
  const ctxInput = buildContext({ task: taskWithInput });
  const promptInput = buildSystemPrompt(ctxInput);
  assert("contains Current Task", promptInput.includes("## Current Task"));
  assert("contains task description", promptInput.includes("Analyze this data"));
  assert("contains Input section", promptInput.includes("### Input"));
  assert("contains input data", promptInput.includes('{"users": 42}'));

  // Test 7: Full composed prompt (all sections)
  console.log("\nTest 7: Full composed prompt — all sections");
  const fullCtx = buildContext({ task: taskWithInput, tools, skills, memory });
  const fullPrompt = buildSystemPrompt(fullCtx);
  assert("has base prompt", fullPrompt.includes("Agent OS"));
  assert("has tools", fullPrompt.includes("## Available Tools"));
  assert("has skills", fullPrompt.includes("## Active Skills"));
  assert("has memory", fullPrompt.includes("## Memory Context"));
  assert("has task", fullPrompt.includes("## Current Task"));
  // Verify order: base → tools → skills → memory → task
  const toolsIdx = fullPrompt.indexOf("## Available Tools");
  const skillsIdx = fullPrompt.indexOf("## Active Skills");
  const memoryIdx = fullPrompt.indexOf("## Memory Context");
  const taskIdx = fullPrompt.indexOf("## Current Task");
  assert("tools before skills", toolsIdx < skillsIdx);
  assert("skills before memory", skillsIdx < memoryIdx);
  assert("memory before task", memoryIdx < taskIdx);

  // Test 8: Empty optional sections are omitted
  console.log("\nTest 8: Empty sections omitted");
  const minimalCtx = buildContext({ task });
  const minimalPrompt = buildSystemPrompt(minimalCtx);
  assert("no tools section", !minimalPrompt.includes("## Available Tools"));
  assert("no skills section", !minimalPrompt.includes("## Active Skills"));
  assert("no memory section", !minimalPrompt.includes("## Memory Context"));

  // Test 9: Agent integration — memory injected into prompt
  console.log("\nTest 9: Agent integration with memory");
  const store = new FileMemoryStore(`${TEST_DIR}/memory`);
  await saveSummary(store, "task_old", "Previous project used PostgreSQL.");

  const registry = new ToolRegistry();
  registry.register(createFinalizeTool());
  registry.register(createReadFileTool("."));

  const agent = new Agent(new MockProvider(["Done with context."]), {
    maxSteps: 5,
    registry,
    skills,
    memoryStore: store,
  });
  const result = await agent.execute(createTask("Build on prior work"));
  assert("agent succeeds", result.success);

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
