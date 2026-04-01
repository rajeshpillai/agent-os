# Agent OS

## Overview
A production-shaped Agent OS in Node.js + TypeScript that turns an LLM into a controllable runtime with: agent loop, tool calling, file-based memory, skills, task runs, observability hooks, and safety boundaries.

Single-process first. Everything inspectable, local, and easy to evolve into a multi-agent system later.

## Tech Stack
- Node.js 22+
- TypeScript
- No framework at first
- File system for persistence
- Provider abstraction for LLMs (mock first, then OpenAI)
- JSON-based run logs (JSONL for append-friendly traces)

## Repo Structure
```
agent-os/
  src/
    index.ts / app.ts          — entry points
    config/env.ts              — environment config
    core/                      — types, task, run, result
    agent/                     — agent loop, context builder, system prompt
    llm/                       — provider abstraction (mock, openai)
    tools/                     — tool contract, registry, builtins
    memory/                    — file-based memory store, summaries
    skills/                    — skill loader, models
    storage/                   — fs utils, paths, JSONL
    runtime/                   — runner, event bus, logger
    cli/                       — arg parsing, commands
    prompts/                   — base system prompt
  skills/                      — skill definitions (SKILL.md per skill)
```

## Build Sequence (15 commits)
1. **Bootstrap** — repo setup, core types, mock LLM, simple runner, demo task (walking skeleton)
2. **Agent loop v1** — think/act/observe loop, stop conditions, max step guard
3. **Tool interface + registry** — generic tool contract, registry, finalize tool, list-files tool
4. **Workspace tools** — read-file, write-file, safe path resolver, workspace boundary
5. **File-based memory** — task/run/summary folders, memory load/save API
6. **Skill system** — SKILL.md loader, dynamic injection, task-based selection
7. **Real LLM provider** — provider interface, OpenAI provider, message/tool-call normalization
8. **System prompt composer** — base prompt, memory/tool/skill/task injection
9. **Shell tool + safety** — shell exec with timeout, cwd control, allowed/blocked commands
10. **Run events + logs** — event bus, JSONL logs, per-step traces, tool result capture
11. **Summarization + memory compression** — run summaries, compact task memory, token-friendly recall
12. **Planner/executor split** — planner/executor roles, plan file, execution checkpoints
13. **Human approval gates** — approval events, dangerous tool review, diff review before apply
14. **Multi-agent shared memory** — shared run context, per-agent logs, handoff envelope
15. **Production hardening** — retries, error taxonomy, run recovery, config validation

## Conventions
- Each commit is a self-contained, working increment
- Mock provider used for commits 01-06; real LLM from commit 07+
- Safety and observability are first-class concerns, not afterthoughts
