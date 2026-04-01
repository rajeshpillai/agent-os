import { AgentError, categorizeError } from "../src/core/errors.js";
import { withRetry } from "../src/runtime/retry.js";
import { validateConfig, assertConfigValid } from "../src/config/validate.js";
import { Config } from "../src/config/env.js";

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

  console.log("\n=== Commit 15 Tests — Production Hardening ===\n");

  // Test 1: AgentError
  console.log("Test 1: AgentError properties");
  const err = new AgentError("API failed", "provider_error", { retryable: true });
  assert("has message", err.message === "API failed");
  assert("has category", err.category === "provider_error");
  assert("is retryable", err.retryable === true);
  assert("is instance of Error", err instanceof Error);
  assert("is instance of AgentError", err instanceof AgentError);
  assert("name is AgentError", err.name === "AgentError");

  // Test 2: AgentError defaults
  console.log("\nTest 2: AgentError defaults");
  const err2 = new AgentError("oops", "unknown_error");
  assert("retryable defaults to false", err2.retryable === false);
  assert("cause is undefined", err2.cause === undefined);

  // Test 3: categorizeError — provider error
  console.log("\nTest 3: Categorize provider errors");
  const apiErr = categorizeError(new Error("API connection failed"));
  assert("category is provider_error", apiErr.category === "provider_error");
  assert("is retryable", apiErr.retryable === true);

  const rateErr = categorizeError(new Error("rate limit exceeded"));
  assert("rate limit is provider_error", rateErr.category === "provider_error");

  // Test 4: categorizeError — timeout
  console.log("\nTest 4: Categorize timeout errors");
  const timeoutErr = categorizeError(new Error("Command timed out after 10000ms"));
  assert("category is timeout_error", timeoutErr.category === "timeout_error");
  assert("is retryable", timeoutErr.retryable === true);

  // Test 5: categorizeError — config
  console.log("\nTest 5: Categorize config errors");
  const configErr = categorizeError(new Error("OPENAI_API_KEY is required"));
  assert("category is config_error", configErr.category === "config_error");
  assert("not retryable", configErr.retryable === false);

  // Test 6: categorizeError — memory/file
  console.log("\nTest 6: Categorize memory errors");
  const fileErr = categorizeError(new Error("ENOENT: no such file"));
  assert("category is memory_error", fileErr.category === "memory_error");

  // Test 7: categorizeError — unknown
  console.log("\nTest 7: Categorize unknown errors");
  const unknownErr = categorizeError(new Error("something weird"));
  assert("category is unknown_error", unknownErr.category === "unknown_error");

  // Test 8: categorizeError — already an AgentError
  console.log("\nTest 8: Pass-through AgentError");
  const existing = new AgentError("known", "tool_error", { retryable: false });
  const passThrough = categorizeError(existing);
  assert("same instance returned", passThrough === existing);

  // Test 9: categorizeError — non-Error input
  console.log("\nTest 9: Categorize string error");
  const strErr = categorizeError("plain string error");
  assert("handles string", strErr.message === "plain string error");

  // Test 10: withRetry — succeeds first try
  console.log("\nTest 10: Retry — succeeds first try");
  let callCount = 0;
  const result = await withRetry(async () => {
    callCount++;
    return "success";
  }, { maxRetries: 3 });
  assert("returns result", result === "success");
  assert("called once", callCount === 1);

  // Test 11: withRetry — succeeds after retries
  console.log("\nTest 11: Retry — succeeds after 2 failures");
  let retryCount = 0;
  const retryResult = await withRetry(async () => {
    retryCount++;
    if (retryCount < 3) throw new Error("API temporarily unavailable");
    return "recovered";
  }, { maxRetries: 3, baseDelayMs: 10 });
  assert("returns result", retryResult === "recovered");
  assert("called 3 times", retryCount === 3);

  // Test 12: withRetry — exhausts retries
  console.log("\nTest 12: Retry — exhausts retries");
  let exhaustCount = 0;
  let exhaustError: AgentError | null = null;
  try {
    await withRetry(async () => {
      exhaustCount++;
      throw new Error("API permanently down");
    }, { maxRetries: 2, baseDelayMs: 10 });
  } catch (e) {
    exhaustError = e as AgentError;
  }
  assert("called 3 times (1 + 2 retries)", exhaustCount === 3);
  assert("throws AgentError", exhaustError instanceof AgentError);
  assert("is provider_error", exhaustError!.category === "provider_error");

  // Test 13: withRetry — non-retryable error stops immediately
  console.log("\nTest 13: Retry — non-retryable stops immediately");
  let nonRetryCount = 0;
  let nonRetryError: AgentError | null = null;
  try {
    await withRetry(async () => {
      nonRetryCount++;
      throw new Error("OPENAI_API_KEY is required");
    }, { maxRetries: 3, baseDelayMs: 10, retryableOnly: true });
  } catch (e) {
    nonRetryError = e as AgentError;
  }
  assert("called only once", nonRetryCount === 1);
  assert("is config_error", nonRetryError!.category === "config_error");

  // Test 14: validateConfig — valid config
  console.log("\nTest 14: Validate valid config");
  const validConfig: Config = {
    llmProvider: "mock",
    maxSteps: 10,
    workspaceRoot: "./workspace",
    openaiModel: "gpt-4o-mini",
  };
  const validResult = validateConfig(validConfig);
  assert("is valid", validResult.valid);
  assert("no errors", validResult.errors.length === 0);

  // Test 15: validateConfig — openai without key
  console.log("\nTest 15: Validate openai without key");
  const noKeyConfig: Config = {
    llmProvider: "openai",
    maxSteps: 10,
    workspaceRoot: "./workspace",
    openaiModel: "gpt-4o-mini",
  };
  const noKeyResult = validateConfig(noKeyConfig);
  assert("is invalid", !noKeyResult.valid);
  assert("error mentions OPENAI_API_KEY", noKeyResult.errors.some(e => e.includes("OPENAI_API_KEY")));

  // Test 16: validateConfig — unknown provider
  console.log("\nTest 16: Validate unknown provider");
  const unknownConfig: Config = {
    llmProvider: "claude",
    maxSteps: 10,
    workspaceRoot: "./workspace",
    openaiModel: "gpt-4o-mini",
  };
  const unknownResult = validateConfig(unknownConfig);
  assert("is invalid", !unknownResult.valid);
  assert("error mentions unknown", unknownResult.errors.some(e => e.includes("Unknown")));

  // Test 17: validateConfig — bad maxSteps
  console.log("\nTest 17: Validate bad maxSteps");
  const badSteps: Config = {
    llmProvider: "mock",
    maxSteps: 0,
    workspaceRoot: "./workspace",
    openaiModel: "gpt-4o-mini",
  };
  const badResult = validateConfig(badSteps);
  assert("is invalid", !badResult.valid);

  const tooMany: Config = { ...validConfig, maxSteps: 200 };
  const tooManyResult = validateConfig(tooMany);
  assert("too many steps invalid", !tooManyResult.valid);

  // Test 18: assertConfigValid — throws on invalid
  console.log("\nTest 18: assertConfigValid throws");
  let assertThrew = false;
  try {
    assertConfigValid(noKeyConfig);
  } catch (e) {
    assertThrew = true;
    assert("throws AgentError", e instanceof AgentError);
    assert("category is config_error", (e as AgentError).category === "config_error");
  }
  assert("did throw", assertThrew);

  // Test 19: assertConfigValid — passes on valid
  console.log("\nTest 19: assertConfigValid passes");
  let assertPassed = true;
  try {
    assertConfigValid(validConfig);
  } catch {
    assertPassed = false;
  }
  assert("did not throw", assertPassed);

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
