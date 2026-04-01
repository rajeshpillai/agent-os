# Agent OS — Build Progress

- [x] Commit 01 — Bootstrap repo + core types + mock run
- [x] Commit 02 — Agent loop v1 (think → act → observe, stop conditions, max step guard)
- [x] Commit 03 — Tool interface + registry
- [x] Commit 04 — Workspace tools
- [x] Commit 05 — File-based memory
- [x] Commit 06 — Skill system
- [x] Commit 07 — Real LLM provider abstraction
- [x] Commit 08 — System prompt composer
- [x] Commit 09 — Shell tool with safety guardrails
- [x] Commit 10 — Run events + logs
- [x] Commit 11 — Summarization + memory compression
- [x] Commit 12 — Planner / executor split
- [x] Commit 13 — Human approval gates
- [x] Commit 14 — Multi-agent shared memory foundation
- [x] Commit 15 — Production hardening

## Post v1
- [x] Commit 16 — Gemini provider (OpenAI-compatible endpoint)
- [x] Commit 17 — CLI (parse-args, run-task command)
- [x] Commit 18 — Ollama provider (local open-source models)
- [x] Commit 19 — Shell tool improvements (smart timeouts, prompt guardrails)
- [x] Commit 20 — README cookbook (full-stack, tools, skills, programmatic usage)
- [x] Commit 21 — --project flag for modifying existing projects
- [x] Commit 22 — Interactive REPL CLI (slash commands, project switching, model switching)

## Interactive REPL CLI (done)
- [x] REPL as default mode — `agent-os` launches interactive session
- [x] Project-aware — first prompt auto-creates project, follow-ups target it
- [x] Resume existing projects — `agent-os --project todo-app` or `/project` command
- [x] Open any directory — `agent-os .` treats cwd as the project
- [x] Slash commands — /project, /projects, /new, /status, /model, /provider, /config, /history, /clear, /help, /exit
- [x] Model switching — `/model gpt-4o` mid-session, `--model` CLI flag
- [x] Provider switching — `/provider ollama` mid-session
- [x] Project file tree scanning — injected into system prompt for existing projects
- [x] Session history tracking
- [x] Backwards compatible — `agent-os run "task"` one-shot still works

## REPL improvements (next)
- [ ] Streaming output — show agent thinking/acting in real-time (not just final result)
- [ ] Conversation memory — follow-ups within a session share context (message history)
- [ ] Tab completion — for slash commands and project names
- [ ] Color output — colored status messages, syntax highlighting in output
- [ ] Multiline input — paste or type multi-line prompts
- [ ] `/undo` — revert last file changes made by the agent
- [ ] `/diff` — show what the agent changed in the last run
- [ ] `/run <script>` — run a script in the project (e.g. `/run npm start`)
- [ ] Auto-detect provider — skip provider flag if only one API key is set in .env
- [ ] Persistent session — save/resume REPL sessions across restarts

## Path A: npm package (reusable for any dev)
- [ ] Clean public API — export Agent, createTask, ToolRegistry, createProvider from package root
- [ ] Add `exports` field to package.json for ESM/CJS consumers
- [ ] Add `#!/usr/bin/env node` shebang to CLI entry point
- [ ] Decouple workspace tools from hardcoded paths (accept config at init)
- [ ] Add `agent-os init` command — scaffolds .env, skills/, workspace/ in a project
- [ ] Write npm package README with install + quickstart
- [ ] Publish to npm as `agent-os`
- [ ] Test: `npx agent-os run "build a hello world app"` works end-to-end

## Path B: VS Code extension (future)
- [ ] Scaffold extension with `yo code` (TypeScript)
- [ ] Command palette: "Agent OS: Run Task" → input box → runs agent
- [ ] Output panel streaming agent loop events via EventBus
- [ ] Settings UI: provider, API key, max steps, model
- [ ] Workspace-aware: auto-detect open folder as WORKSPACE_ROOT
- [ ] Status bar: show agent running/idle state
- [ ] Code review skill: "Agent OS: Review Selection" command

## Skills to add
- [x] `fullstack` — React + Express + Tailwind with design system
- [x] `react-frontend` — React SPA with component library
- [x] `nextjs` — Next.js App Router + Prisma
- [x] `python-api` — FastAPI + SQLAlchemy
- [x] `static-site` — HTML/CSS/JS with design tokens
- [ ] `code-review` — review existing code for bugs, security, style
- [ ] `devops` — Dockerfile, CI/CD, deploy scripts
- [ ] `testing` — write unit/integration tests
