# Agent OS

A production-shaped Agent OS built in Node.js + TypeScript that turns an LLM into a controllable runtime with: agent loop, tool calling, file-based memory, skills, task runs, observability hooks, and safety boundaries.

## Features

- **Agent Loop** — think → act → observe cycle with configurable stop conditions
- **Tool Calling** — generic tool contract with built-in and custom tools
- **File-based Memory** — persistence across runs with summaries and facts
- **Skills** — modular capability packs loaded dynamically per task
- **Multi-Provider LLM** — OpenAI, Gemini, Ollama (local models), and mock provider
- **Observability** — JSONL logs, event bus, per-step traces
- **Safety Boundaries** — approval gates, command allowlists, path sandboxing

## Tech Stack

- Node.js 22+
- TypeScript (no framework — intentionally minimal)
- File system for persistence
- Provider abstraction for LLMs

## Quick Start

```bash
npm install
cp .env.example .env   # configure your provider

# Dev mode (runs src/index.ts demo)
npm run dev

# CLI mode
npm run cli -- run "Your task description here"
```

## Configuration

Set these in `.env` or as environment variables:

```bash
# Provider: mock | openai | gemini | ollama
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini          # default

# Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash     # default

# Ollama (local models — no API key needed)
OLLAMA_MODEL=llama3                # default
OLLAMA_BASE_URL=http://localhost:11434/v1   # default

# Agent settings
AGENT_MAX_STEPS=10                 # 1-100
WORKSPACE_ROOT=./workspace
```

### Using Ollama (Local Models)

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3`
3. Set `LLM_PROVIDER=ollama` in `.env`
4. Optionally set `OLLAMA_MODEL` (defaults to `llama3`)
5. Run your task — no API key needed

```bash
npm run cli -- run "Create a hello world Express server" --provider ollama
```

Any model that Ollama supports works: `llama3`, `mistral`, `codellama`, `deepseek-coder`, `phi3`, etc.

You can also point to a remote Ollama instance by setting `OLLAMA_BASE_URL`.

## CLI Usage

```bash
# Run a task (creates workspace/read-readme-md-and-summarize-it/)
npm run cli -- run "Read README.md and summarize it"

# With a custom project name (creates workspace/my-api/)
npm run cli -- run "Build an API server" --name my-api --provider openai --max-steps 20

# Point to an existing project (no auto-naming)
npm run cli -- run "Refactor utils" --workspace ./my-project

# Other options
npm run cli -- run "Research codebase" --skills-dir ./skills --verbose

# Help
npm run cli -- help
```

### Project Isolation

Each task gets its own project folder inside the workspace:

```
workspace/
  create-a-fullstack-todo-app/    ← auto-named from task
    backend/
    frontend/
    package.json
  my-api/                          ← named with --name my-api
    src/
    package.json
```

The project name is auto-generated from the task description (slugified). Override with `--name`:

```bash
npm run cli -- run "Create a todo app" --name todo-app
```

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--provider <name>` | LLM provider (`mock`, `openai`, `gemini`, `ollama`) | from `.env` |
| `--max-steps <n>` | Maximum agent loop steps | `10` |
| `--name <name>` | Project folder name | auto-generated from task |
| `--workspace <path>` | Workspace root directory | `./workspace` |
| `--skills-dir <path>` | Skills directory | `./skills` |
| `--logs-dir <path>` | JSONL logs directory | `./.agent-os/logs` |
| `--verbose` | Enable verbose logging | `false` |

---

## Cookbook

### 1. Full-Stack App (React + Express + Tailwind)

Auto-activates the **fullstack** skill — produces a polished UI with Tailwind CSS, Lucide icons, and responsive layout.

```bash
npm run cli -- run \
  "Create a full-stack todo app: Express API backend with CRUD endpoints at /api/todos, \
   and a React frontend (Vite + Tailwind) that displays, adds, and deletes todos. \
   Add a root package.json with scripts to run both." \
  --name todo-app --provider openai --max-steps 25
```

### 2. Next.js App (App Router + Prisma)

Auto-activates the **nextjs** skill — uses Server Components, Server Actions, and Prisma with SQLite.

```bash
npm run cli -- run \
  "Create a Next.js bookmarks app with App Router: \
   - Prisma + SQLite for storage \
   - Server Actions for create/delete \
   - Tailwind CSS for styling \
   - List, add, and remove bookmarks with tags" \
  --name bookmarks --provider openai --max-steps 25
```

### 3. Python API (FastAPI)

Auto-activates the **python-api** skill — uses FastAPI, Pydantic, SQLAlchemy async, and SQLite.

```bash
npm run cli -- run \
  "Create a FastAPI REST API for a notes app: \
   - CRUD endpoints at /api/notes \
   - SQLAlchemy with async SQLite \
   - Pydantic schemas for validation \
   - Auto-generated OpenAPI docs" \
  --name notes-api --provider openai --max-steps 20
```

### 4. Static Website (HTML/CSS/JS)

Auto-activates the **static-site** skill — modern CSS with custom properties, responsive grid, smooth animations.

```bash
npm run cli -- run \
  "Create a portfolio website with HTML, CSS, and vanilla JS. \
   Include: hero section with gradient, projects grid, about section, contact form. \
   Use modern CSS (grid, custom properties). Make it responsive and beautiful." \
  --name portfolio --provider openai --max-steps 15
```

### 5. React SPA (Single-Page App)

Auto-activates the **react-frontend** skill — React + Vite + Tailwind + React Query + Lucide.

```bash
npm run cli -- run \
  "Create a React dashboard SPA with Vite + Tailwind: \
   - Sidebar navigation \
   - Dashboard page with stat cards and a table \
   - Settings page with a form \
   - Responsive layout" \
  --name dashboard --provider openai --max-steps 25
```

### 6. Any Framework — Just Ask

Skills are defaults, not constraints. Specify any stack in the task prompt:

```bash
# SolidJS
npm run cli -- run \
  "Create a todo app using SolidJS + Vite + Tailwind CSS with signals for state" \
  --name solid-todo --provider openai --max-steps 20

# Vue 3
npm run cli -- run \
  "Create a Vue 3 + Vite + Tailwind CSS weather dashboard with Composition API" \
  --name vue-weather --provider openai --max-steps 20

# Svelte
npm run cli -- run \
  "Create a SvelteKit app with a notes CRUD interface, Tailwind CSS, and SQLite" \
  --name svelte-notes --provider openai --max-steps 25
```

### 7. Refactor Existing Code

Point the workspace at your project:

```bash
npm run cli -- run \
  "Read all files in src/utils/ and refactor: extract common patterns, \
   add TypeScript types, remove dead code." \
  --provider openai --max-steps 15 --workspace ./my-project
```

### 8. Research & Summarize a Codebase

```bash
npm run cli -- run \
  "Analyze this codebase: list all source files, read the key modules, \
   and produce a summary of the architecture, dependencies, and entry points." \
  --provider openai --max-steps 10 --workspace ./some-repo
```

### 9. Local Models (Ollama) for Privacy

For sensitive codebases where you don't want code leaving your machine:

```bash
ollama pull codellama
npm run cli -- run \
  "Read the source files and add JSDoc comments to all exported functions." \
  --provider ollama --max-steps 15 --workspace ./private-project
```

---

## Creating Custom Tools

Tools give the agent new capabilities. Each tool has a definition (name, description, parameters) and an `execute` function.

```typescript
// src/tools/custom/fetch-url.tool.ts
import { Tool } from "../tool.js";

export function createFetchUrlTool(): Tool {
  return {
    definition: {
      name: "fetch_url",
      description: "Fetch the contents of a URL and return the response body as text.",
      parameters: [
        {
          name: "url",
          type: "string",
          description: "The URL to fetch",
          required: true,
        },
      ],
    },
    async execute(args) {
      const url = args.url as string;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    },
  };
}
```

Register it in your entry point:

```typescript
import { createFetchUrlTool } from "./tools/custom/fetch-url.tool.js";

registry.register(createFetchUrlTool());
```

### Built-in Tools

| Tool | Description |
|------|-------------|
| `finalize` | Mark the task as complete with a result |
| `read_file` | Read a file from the workspace |
| `write_file` | Write content to a file in the workspace |
| `list_files` | List directory contents |
| `shell` | Execute a shell command (with safety checks) |

---

## Creating Custom Skills

Skills are markdown files that inject domain expertise into the agent's system prompt. They are auto-selected based on task description keywords.

### Skill file format

Create `skills/<skill-name>/SKILL.md`:

```markdown
---
name: fullstack
description: Build full-stack web applications
tags: fullstack, frontend, backend, api, react, express, web, app
tools: read_file, write_file, list_files, shell
---

You are a senior full-stack engineer. When building an application:

1. Scaffold the backend first (Express/Fastify + TypeScript)
2. Define API routes with proper error handling and validation
3. Scaffold the frontend (React + Vite)
4. Wire the frontend to the backend API
5. Add a root package.json with dev scripts to run both
6. Verify the project structure is complete
```

### Built-in Skills

| Skill | Triggers on | What it does |
|-------|------------|--------------|
| **fullstack** | "fullstack", "todo app", "crud", "dashboard" | React + Vite + Tailwind + Express. Includes UI standards (colors, spacing, components), Tailwind setup, and project structure. |
| **react-frontend** | "react", "spa", "dashboard", "landing" | React SPA with Vite + Tailwind + React Query + Lucide icons. Reusable component patterns (Button, Card). |
| **nextjs** | "nextjs", "next.js", "ssr", "server actions" | Next.js App Router + Server Components + Prisma/SQLite. Server Actions for mutations. |
| **python-api** | "python", "fastapi", "flask" | FastAPI + Pydantic v2 + SQLAlchemy 2.0 async + SQLite. Auto-generated OpenAPI docs. |
| **static-site** | "static", "portfolio", "landing page", "website" | Pure HTML/CSS/JS. Modern CSS (custom properties, grid, clamp). No build tools. |
| **coding** | "code", "refactor", "debug", "fix" | General code reading, writing, and modification. |
| **research** | "research", "analyze", "summarize" | Read-only codebase analysis and summarization. |

Skills live in `skills/<name>/SKILL.md`. Each contains UI design standards, library choices, file structure templates, and rules — so the agent produces polished, consistent output.

### How skill selection works

When a task is run, the agent matches the task description against each skill's `name`, `description`, and `tags`. Matching skills are injected into the system prompt automatically — no manual selection needed.

You can override skill defaults by being specific in the task prompt. For example, saying "use SolidJS" will make the agent use SolidJS even if the fullstack skill defaults to React.

---

## Programmatic Usage

Use agent-os as a library in your own scripts:

```typescript
import { Agent } from "./agent/agent.js";
import { createTask } from "./core/task.js";
import { loadConfig } from "./config/env.js";
import { createProvider } from "./llm/llm.js";
import { ToolRegistry } from "./tools/registry.js";
import { createFinalizeTool } from "./tools/builtins/finalize.tool.js";
import { createReadFileTool } from "./tools/builtins/read-file.tool.js";
import { createWriteFileTool } from "./tools/builtins/write-file.tool.js";
import { createListFilesTool } from "./tools/builtins/list-files.tool.js";
import { createShellTool } from "./tools/builtins/shell.tool.js";
import { loadAllSkills, selectSkillsForTask } from "./skills/skill-loader.js";

const config = loadConfig();

// Register tools
const registry = new ToolRegistry();
registry.register(createFinalizeTool());
registry.register(createReadFileTool("./workspace"));
registry.register(createWriteFileTool("./workspace"));
registry.register(createListFilesTool("./workspace"));
registry.register(createShellTool({ workspaceRoot: "./workspace" }));

// Load and select skills
const skills = loadAllSkills("./skills");
const selected = selectSkillsForTask(skills, "build a REST API");

// Create provider and agent
const provider = createProvider(config, { tools: registry.list() });
const agent = new Agent(provider, {
  maxSteps: config.maxSteps,
  registry,
  skills: selected,
});

// Run
const task = createTask("Build a REST API with Express and TypeScript");
const result = await agent.execute(task);

console.log(result.success ? "Done!" : "Failed");
console.log(result.output);
```

---

## Architecture

```
User/CLI
  │
  ▼
┌──────────────┐
│  Agent       │  ← orchestrates the run
│  ┌────────┐  │
│  │  Loop   │  │  ← think → act → observe cycle
│  └────────┘  │
└──────┬───────┘
       │
  ┌────┴────┐
  ▼         ▼
Provider   Tools        Skills       Memory
(LLM)      (registry)   (auto-loaded) (file-based)
```

- **Agent** creates a run, builds the system prompt (with tools, skills, memory), and drives the loop
- **Loop** queries the LLM, executes tool calls, feeds results back, repeats until done or max steps
- **Tools** are sandboxed (path boundaries, command filtering, timeouts)
- **Skills** inject domain knowledge into the prompt based on task matching
- **Memory** persists tasks, runs, and summaries across sessions
- **EventBus** emits events at each step for logging and observability

## Project Status

Building commit-by-commit. See [CLAUDE.md](CLAUDE.md) for the full build plan.

## License

MIT
