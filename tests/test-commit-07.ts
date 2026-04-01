import { loadConfig } from "../src/config/env.js";
import { createProvider } from "../src/llm/llm.js";
import { MockProvider } from "../src/llm/providers/mock.provider.js";
import { OpenAIProvider } from "../src/llm/providers/openai.provider.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
import { createReadFileTool } from "../src/tools/builtins/read-file.tool.js";
import { Agent } from "../src/agent/agent.js";
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

  console.log("\n=== Commit 07 Tests — LLM Provider Abstraction ===\n");

  // Test 1: Config loads .env
  console.log("Test 1: Config loads .env values");
  const config = loadConfig();
  assert("llmProvider is set", typeof config.llmProvider === "string");
  assert("maxSteps is a number", typeof config.maxSteps === "number");
  assert("openaiModel has default", config.openaiModel === (process.env.OPENAI_MODEL ?? "gpt-4o-mini"));

  // Test 2: createProvider — mock
  console.log("\nTest 2: createProvider returns MockProvider");
  const mockConfig = { ...config, llmProvider: "mock" };
  const mockProvider = createProvider(mockConfig);
  assert("returns a provider", mockProvider !== null);
  assert("is MockProvider", mockProvider instanceof MockProvider);

  // Test 3: createProvider — openai (if key available)
  console.log("\nTest 3: createProvider returns OpenAIProvider");
  if (config.openaiApiKey) {
    const openaiConfig = { ...config, llmProvider: "openai" };
    const openaiProvider = createProvider(openaiConfig);
    assert("returns a provider", openaiProvider !== null);
    assert("is OpenAIProvider", openaiProvider instanceof OpenAIProvider);
  } else {
    console.log("  ⊘ skipped (no OPENAI_API_KEY)");
  }

  // Test 4: createProvider — openai without key throws
  console.log("\nTest 4: createProvider throws without API key");
  let threw = false;
  try {
    createProvider({ ...config, llmProvider: "openai", openaiApiKey: undefined });
  } catch {
    threw = true;
  }
  assert("throws without key", threw);

  // Test 5: createProvider — unknown provider throws
  console.log("\nTest 5: createProvider throws for unknown provider");
  let threwUnknown = false;
  try {
    createProvider({ ...config, llmProvider: "claude" });
  } catch {
    threwUnknown = true;
  }
  assert("throws for unknown", threwUnknown);

  // Test 6: createProvider with tool definitions
  console.log("\nTest 6: createProvider passes tool definitions");
  if (config.openaiApiKey) {
    const registry = new ToolRegistry();
    registry.register(createFinalizeTool());
    registry.register(createReadFileTool("."));
    const openaiConfig = { ...config, llmProvider: "openai" };
    const provider = createProvider(openaiConfig, { tools: registry.list() });
    assert("provider created with tools", provider instanceof OpenAIProvider);
  } else {
    console.log("  ⊘ skipped (no OPENAI_API_KEY)");
  }

  // Test 7: Mock provider still works through factory
  console.log("\nTest 7: Agent with mock provider via factory");
  const mockP = createProvider({ ...config, llmProvider: "mock" });
  const agent = new Agent(mockP, { maxSteps: 5 });
  const result = await agent.execute(createTask("Test task"));
  assert("agent succeeds with factory mock", result.success);

  // Test 8: Live OpenAI test (only if key is present)
  console.log("\nTest 8: Live OpenAI API call");
  if (config.openaiApiKey) {
    const registry = new ToolRegistry();
    registry.register(createFinalizeTool());

    const openaiConfig = { ...config, llmProvider: "openai" };
    const provider = createProvider(openaiConfig, { tools: registry.list() });

    const agent = new Agent(provider, {
      maxSteps: 3,
      registry,
    });

    const liveResult = await agent.execute(createTask("What is 2 + 2? Reply with just the number."));
    assert("live call succeeds", liveResult.success);
    assert("output contains 4", liveResult.output.includes("4"));
    console.log(`  → Output: ${liveResult.output.slice(0, 100)}`);
  } else {
    console.log("  ⊘ skipped (no OPENAI_API_KEY)");
  }

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
