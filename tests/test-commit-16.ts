import { loadConfig, Config } from "../src/config/env.js";
import { createProvider } from "../src/llm/llm.js";
import { OpenAIProvider } from "../src/llm/providers/openai.provider.js";
import { validateConfig } from "../src/config/validate.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createFinalizeTool } from "../src/tools/builtins/finalize.tool.js";
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

  const config = loadConfig();

  console.log("\n=== Commit 16 Tests — Gemini Provider ===\n");

  // Test 1: Config loads Gemini fields
  console.log("Test 1: Config loads Gemini fields");
  assert("geminiModel has default", config.geminiModel === (process.env.GEMINI_MODEL ?? "gemini-2.0-flash"));
  assert("geminiApiKey loaded", config.geminiApiKey === process.env.GEMINI_API_KEY);

  // Test 2: createProvider — gemini (if key available)
  console.log("\nTest 2: createProvider returns OpenAIProvider for gemini");
  if (config.geminiApiKey) {
    const geminiConfig = { ...config, llmProvider: "gemini" };
    const provider = createProvider(geminiConfig);
    assert("returns a provider", provider !== null);
    assert("is OpenAIProvider (compatible mode)", provider instanceof OpenAIProvider);
  } else {
    console.log("  ⊘ skipped (no GEMINI_API_KEY)");
  }

  // Test 3: createProvider — gemini without key throws
  console.log("\nTest 3: createProvider throws without GEMINI_API_KEY");
  let threw = false;
  try {
    createProvider({ ...config, llmProvider: "gemini", geminiApiKey: undefined });
  } catch (e) {
    threw = true;
    assert("error mentions GEMINI_API_KEY", (e as Error).message.includes("GEMINI_API_KEY"));
  }
  assert("throws without key", threw);

  // Test 4: Validate config — gemini valid
  console.log("\nTest 4: Validate gemini config — valid");
  const validGemini: Config = {
    llmProvider: "gemini",
    geminiApiKey: "AIzaFakeKey",
    geminiModel: "gemini-2.0-flash",
    openaiModel: "gpt-4o-mini",
    maxSteps: 10,
    workspaceRoot: "./workspace",
  };
  const validResult = validateConfig(validGemini);
  assert("is valid", validResult.valid);

  // Test 5: Validate config — gemini without key
  console.log("\nTest 5: Validate gemini config — missing key");
  const noKeyGemini: Config = {
    llmProvider: "gemini",
    geminiModel: "gemini-2.0-flash",
    openaiModel: "gpt-4o-mini",
    maxSteps: 10,
    workspaceRoot: "./workspace",
  };
  const noKeyResult = validateConfig(noKeyGemini);
  assert("is invalid", !noKeyResult.valid);
  assert("error mentions GEMINI_API_KEY", noKeyResult.errors.some(e => e.includes("GEMINI_API_KEY")));

  // Test 6: Validate config — gemini is a supported provider
  console.log("\nTest 6: Gemini in supported providers list");
  const geminiConfig: Config = {
    llmProvider: "gemini",
    geminiApiKey: "test",
    geminiModel: "gemini-2.0-flash",
    openaiModel: "gpt-4o-mini",
    maxSteps: 10,
    workspaceRoot: "./workspace",
  };
  const geminiResult = validateConfig(geminiConfig);
  assert("gemini is valid provider", !geminiResult.errors.some(e => e.includes("Unknown")));

  // Test 7: createProvider with tools for gemini
  console.log("\nTest 7: createProvider passes tools for gemini");
  if (config.geminiApiKey) {
    const reg = new ToolRegistry();
    reg.register(createFinalizeTool());
    const provider = createProvider(
      { ...config, llmProvider: "gemini" },
      { tools: reg.list() }
    );
    assert("provider created with tools", provider instanceof OpenAIProvider);
  } else {
    console.log("  ⊘ skipped (no GEMINI_API_KEY)");
  }

  // Test 8: Live Gemini API call (only if key present)
  console.log("\nTest 8: Live Gemini API call");
  if (config.geminiApiKey) {
    const reg = new ToolRegistry();
    reg.register(createFinalizeTool());

    const provider = createProvider(
      { ...config, llmProvider: "gemini" },
      { tools: reg.list() }
    );

    const agent = new Agent(provider, {
      maxSteps: 3,
      registry: reg,
    });

    const result = await agent.execute(createTask("What is 3 + 3? Reply with just the number."));
    assert("live call succeeds", result.success);
    assert("output contains 6", result.output.includes("6"));
    console.log(`  → Output: ${result.output.slice(0, 100)}`);
  } else {
    console.log("  ⊘ skipped (no GEMINI_API_KEY)");
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
