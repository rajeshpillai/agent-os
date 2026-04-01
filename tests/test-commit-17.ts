import { parseArgs, showHelp } from "../src/cli/parse-args.js";

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

  console.log("\n=== Commit 17 Tests — CLI ===\n");

  // Test 1: Parse basic run command
  console.log("Test 1: Parse run command");
  const r1 = parseArgs(["node", "app.ts", "run", "Fix the login bug"]);
  assert("command is run", r1.command === "run");
  assert("task captured", r1.task === "Fix the login bug");

  // Test 2: Parse run with flags
  console.log("\nTest 2: Parse run with flags");
  const r2 = parseArgs(["node", "app.ts", "run", "Do something", "--provider", "openai", "--max-steps", "5"]);
  assert("command is run", r2.command === "run");
  assert("task captured", r2.task === "Do something");
  assert("provider flag", r2.flags.provider === "openai");
  assert("max-steps flag", r2.flags["max-steps"] === "5");

  // Test 3: Parse flag with = syntax
  console.log("\nTest 3: Flag with = syntax");
  const r3 = parseArgs(["node", "app.ts", "run", "task", "--provider=gemini"]);
  assert("provider parsed", r3.flags.provider === "gemini");

  // Test 4: Parse boolean flag
  console.log("\nTest 4: Boolean flag");
  const r4 = parseArgs(["node", "app.ts", "run", "task", "--verbose"]);
  assert("verbose is true", r4.flags.verbose === true);

  // Test 5: Parse help command
  console.log("\nTest 5: Help command");
  const r5 = parseArgs(["node", "app.ts", "help"]);
  assert("command is help", r5.command === "help");

  // Test 6: Default to help when no args
  console.log("\nTest 6: No args defaults to help");
  const r6 = parseArgs(["node", "app.ts"]);
  assert("command is help", r6.command === "help");

  // Test 7: showHelp returns content
  console.log("\nTest 7: showHelp output");
  const help = showHelp();
  assert("contains usage", help.includes("Usage:"));
  assert("contains run command", help.includes("agent-os run"));
  assert("contains options", help.includes("Options:"));
  assert("contains --provider", help.includes("--provider"));
  assert("contains --max-steps", help.includes("--max-steps"));

  // Test 8: Multiple positional args
  console.log("\nTest 8: Multiple positional args");
  const r8 = parseArgs(["node", "app.ts", "run", "task one", "extra arg"]);
  assert("task is first positional", r8.task === "task one");
  assert("2 positional args", r8.positional.length === 2);

  // Test 9: Workspace flag
  console.log("\nTest 9: Workspace flag");
  const r9 = parseArgs(["node", "app.ts", "run", "task", "--workspace", "./my-project"]);
  assert("workspace captured", r9.flags.workspace === "./my-project");

  // Test 10: Skills-dir and logs-dir flags
  console.log("\nTest 10: Skills and logs dir flags");
  const r10 = parseArgs(["node", "app.ts", "run", "task", "--skills-dir", "./my-skills", "--logs-dir", "./my-logs"]);
  assert("skills-dir captured", r10.flags["skills-dir"] === "./my-skills");
  assert("logs-dir captured", r10.flags["logs-dir"] === "./my-logs");

  // Test 11: CLI runs with mock provider
  console.log("\nTest 11: CLI end-to-end with mock");
  const { execSync } = await import("node:child_process");
  try {
    const output = execSync(
      'npx tsx src/app.ts run "What is 2+2?" --provider mock',
      { encoding: "utf-8", timeout: 10000 }
    );
    assert("CLI produces output", output.length > 0);
    assert("contains result separator", output.includes("─"));
    assert("contains Steps info", output.includes("Steps:"));
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    console.log("  stdout:", err.stdout?.slice(0, 200));
    console.log("  stderr:", err.stderr?.slice(0, 200));
    assert("CLI runs without error", false);
  }

  // Test 12: CLI help command
  console.log("\nTest 12: CLI help command");
  try {
    const helpOutput = execSync("npx tsx src/app.ts help", { encoding: "utf-8", timeout: 5000 });
    assert("help output shows usage", helpOutput.includes("Usage:"));
  } catch {
    assert("help command works", false);
  }

  // Test 13: CLI unknown command exits with error
  console.log("\nTest 13: CLI unknown command");
  try {
    execSync("npx tsx src/app.ts foobar", { encoding: "utf-8", timeout: 5000 });
    assert("should have exited with error", false);
  } catch (e) {
    const err = e as { status?: number };
    assert("exits with non-zero", err.status !== 0);
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
