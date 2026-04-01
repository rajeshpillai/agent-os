# Agent OS

A production-shaped Agent OS built in Node.js + TypeScript that turns an LLM into a controllable runtime.

## Features (planned)

- **Agent Loop** — think → act → observe cycle with stop conditions
- **Tool Calling** — generic tool contract with built-in and custom tools
- **File-based Memory** — persistence across runs with summaries
- **Skills** — modular capability packs loaded dynamically
- **Observability** — JSONL logs, event bus, per-step traces
- **Safety Boundaries** — approval gates, command allowlists, path sandboxing

## Tech Stack

- Node.js 22+
- TypeScript
- No framework — intentionally minimal
- File system for persistence
- Provider abstraction for LLMs (mock, OpenAI)

## Quick Start

```bash
npm install
npm run dev
```

## Project Status

Building commit-by-commit. See [CLAUDE.md](CLAUDE.md) for the full build plan.
