import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { loadSkill, loadAllSkills, selectSkillsForTask, formatSkillsForPrompt } from "../src/skills/skill-loader.js";
import { buildSystemPrompt } from "../src/agent/system-prompt.js";
import { createTask } from "../src/core/task.js";
import { Agent } from "../src/agent/agent.js";
import { MockProvider } from "../src/llm/providers/mock.provider.js";

const TEST_DIR = "/tmp/agent-os-test-06-skills";

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

  // Setup test skill dirs
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(`${TEST_DIR}/coding`, { recursive: true });
  mkdirSync(`${TEST_DIR}/research`, { recursive: true });
  mkdirSync(`${TEST_DIR}/empty-dir`, { recursive: true }); // no SKILL.md

  writeFileSync(`${TEST_DIR}/coding/SKILL.md`, `---
name: coding
description: Write and modify code
tags: code, implement, debug, fix
tools: read_file, write_file
---

You are a skilled coder. Write clean code.
`);

  writeFileSync(`${TEST_DIR}/research/SKILL.md`, `---
name: research
description: Research and analyze information
tags: research, analyze, summarize
tools: read_file
---

You are a thorough researcher. Cite your sources.
`);

  console.log("\n=== Commit 06 Tests — Skill System ===\n");

  // Test 1: Load single skill
  console.log("Test 1: Load single skill from directory");
  const coding = loadSkill(`${TEST_DIR}/coding`);
  assert("skill loaded", coding !== null);
  assert("name is coding", coding!.name === "coding");
  assert("has description", coding!.description === "Write and modify code");
  assert("has tags", coding!.tags.length === 4);
  assert("has tools", coding!.tools?.length === 2);
  assert("has instructions", coding!.instructions.includes("skilled coder"));

  // Test 2: Load skill without SKILL.md
  console.log("\nTest 2: Skip directory without SKILL.md");
  const empty = loadSkill(`${TEST_DIR}/empty-dir`);
  assert("returns null", empty === null);

  // Test 3: Load all skills
  console.log("\nTest 3: Load all skills from root");
  const all = loadAllSkills(TEST_DIR);
  assert("loads 2 skills", all.length === 2);
  assert("has coding", all.some(s => s.name === "coding"));
  assert("has research", all.some(s => s.name === "research"));

  // Test 4: Load from nonexistent directory
  console.log("\nTest 4: Load from nonexistent directory");
  const none = loadAllSkills("/tmp/does-not-exist-skills");
  assert("returns empty array", none.length === 0);

  // Test 5: Select skills by tag match
  console.log("\nTest 5: Select skills — tag match");
  const codeMatch = selectSkillsForTask(all, "Implement a new REST endpoint");
  assert("matches coding skill", codeMatch.some(s => s.name === "coding"));

  const researchMatch = selectSkillsForTask(all, "Analyze the log files and summarize findings");
  assert("matches research skill", researchMatch.some(s => s.name === "research"));

  // Test 6: Select skills — name match
  console.log("\nTest 6: Select skills — name match");
  const nameMatch = selectSkillsForTask(all, "Use research to find the answer");
  assert("matches by name", nameMatch.some(s => s.name === "research"));

  // Test 7: Select skills — no match
  console.log("\nTest 7: Select skills — no match");
  const noMatch = selectSkillsForTask(all, "Deploy to production");
  assert("no skills matched", noMatch.length === 0);

  // Test 8: Format skills for prompt
  console.log("\nTest 8: Format skills for prompt");
  const formatted = formatSkillsForPrompt(all);
  assert("contains Active Skills header", formatted.includes("## Active Skills"));
  assert("contains coding skill", formatted.includes("### Skill: coding"));
  assert("contains research skill", formatted.includes("### Skill: research"));
  assert("contains tool list", formatted.includes("read_file, write_file"));

  // Test 9: Format empty skills
  console.log("\nTest 9: Format empty skills");
  const emptyFormatted = formatSkillsForPrompt([]);
  assert("returns empty string", emptyFormatted === "");

  // Test 10: System prompt includes skills
  console.log("\nTest 10: System prompt includes skills");
  const task = createTask("Debug the login function");
  const prompt = buildSystemPrompt({ task, skills: all });
  assert("prompt includes skills section", prompt.includes("## Active Skills"));
  assert("prompt includes task", prompt.includes("Debug the login function"));

  // Test 11: System prompt without skills (backward compat)
  console.log("\nTest 11: System prompt without skills");
  const promptNoSkills = buildSystemPrompt({ task });
  assert("no skills section", !promptNoSkills.includes("## Active Skills"));
  assert("still has task", promptNoSkills.includes("Debug the login function"));

  // Test 12: Frontmatter-less SKILL.md
  console.log("\nTest 12: SKILL.md without frontmatter");
  mkdirSync(`${TEST_DIR}/plain`, { recursive: true });
  writeFileSync(`${TEST_DIR}/plain/SKILL.md`, "Just some instructions with no frontmatter.");
  const plain = loadSkill(`${TEST_DIR}/plain`);
  assert("skill loaded", plain !== null);
  assert("name derived from dir", plain!.name === "plain");
  assert("instructions from body", plain!.instructions === "Just some instructions with no frontmatter.");
  assert("empty tags", plain!.tags.length === 0);

  // Test 13: Agent with skills injected
  console.log("\nTest 13: Agent with skills");
  const agent = new Agent(new MockProvider(["Task done with coding skill."]), {
    maxSteps: 5,
    skills: [coding!],
  });
  const result = await agent.execute(createTask("Fix the bug in auth.ts"));
  assert("agent succeeds", result.success);
  assert("output correct", result.output === "Task done with coding skill.");

  // Test 14: Real skills directory
  console.log("\nTest 14: Load real project skills");
  const realSkills = loadAllSkills("./skills");
  assert("loads real skills", realSkills.length >= 2);
  assert("has real coding skill", realSkills.some(s => s.name === "coding"));
  assert("has real research skill", realSkills.some(s => s.name === "research"));

  // Cleanup
  rmSync(TEST_DIR, { recursive: true, force: true });

  // Summary
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
