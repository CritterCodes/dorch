# Dorch

**License Notice:**

Dorch is open source for personal, educational, and non-commercial use only. Commercial use, resale, or distribution for profit is **not permitted**. See the [LICENSE](LICENSE) file for details.

Autonomous AI coding orchestrator. Runs Codex CLI and Claude CLI as interchangeable workers on a shared sprint. Manages the plan, memory, handoffs, and agent switching so work continues uninterrupted — even across rate limits, timeouts, or crashes.

## How it works

1. Create a project and describe a sprint goal in the web UI
2. The Planner (claude-cli) asks clarifying questions, then writes the task plan
3. Approve the plan — the first agent starts on a dedicated sprint branch
4. Agents signal `STEP COMPLETE` when a task passes tests; Dorch advances to the next task automatically
5. If an agent hits a rate limit, stalls, or crashes — Dorch writes a handoff and switches to the other agent
6. The new agent reads the handoff and picks up exactly where the last one stopped
7. When all tasks are done, close the sprint and merge the branch from the Status tab

## Prerequisites

- Node.js 20+
- Docker Desktop (for MongoDB) or a MongoDB URI
- `codex` CLI — `npm install -g @openai/codex`
- `claude` CLI — `npm install -g @anthropic-ai/claude-code`

Log into each CLI before running Dorch:

```bash
codex login
claude auth login
```

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are optional — leave them blank when using stored CLI login.

## Setup

```bash
git clone https://github.com/CritterCodes/dorch
cd dorch
npm install
npm run ui:install && npm run ui:build
cp .env.example .env
# Edit .env — required: DORCH_SESSION_SECRET and DORCH_SESSION_PASSWORD
```

## Start

```bash
npm run mongo:up   # starts MongoDB via Docker Compose
npm start          # starts Dorch on http://localhost:3000
```

Open `http://localhost:3000` in your browser (phone-sized UI, works on mobile too).

Hit **Load demo project** on the Projects screen to explore every tab with realistic data — no real agents needed.

## Project model

```
Project
  └── Sprint (one active at a time, runs on a git branch)
        └── Tasks (worked by agents in sequence)
```

- **Project** — persistent workspace with a git repo clone and markdown memory files
- **Sprint** — a focused goal, a branch (`agent/sprint-NN-<slug>`), and a Planner conversation
- **Task** — a discrete step; an agent signals `STEP COMPLETE` when tests pass

## Web UI tabs

| Tab | Purpose |
|-----|---------|
| Status | Agent state, sprint info, Approve / Switch / Stop / Close / Merge actions |
| Chat | Planner conversation — plan your sprint here |
| Logs | Live SSE stream of agent stdout + Dorch events |
| Plan | Current sprint plan with task progress |
| Handoff | Latest handoff written when an agent switched |

## Configuration

All config is via environment variables. See `.env.example` for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `DORCH_SESSION_SECRET` | *(required)* | Express session signing secret |
| `DORCH_SESSION_PASSWORD` | *(required)* | UI login password |
| `DORCH_MONGO_URI` | `mongodb://localhost:27017/dorch` | MongoDB connection string |
| `DORCH_PORT` | `3000` | Web UI port |
| `DORCH_PRIMARY_AGENT` | `codex-cli` | First agent to use per sprint |
| `DORCH_AGENTS` | `codex-cli,claude-cli` | Comma-separated agent rotation list |
| `DORCH_NO_OUTPUT_TIMEOUT_MS` | `180000` | Switch after 3 min of silence |
| `DORCH_MAX_RUNTIME_MS` | `2700000` | Switch after 45 min total runtime |
| `DORCH_MAX_SWITCHES_PER_TASK` | `6` | Pause and wait for user after this many switches |
| `DORCH_TEST_COMMAND` | `npm test` | Command run when agent signals `STEP COMPLETE` |
| `DORCH_PROJECTS_DIR` | `./projects` | Where project workspaces are stored |

## Crash recovery

On boot, Dorch scans each project's run-log. If an agent was running at the time of the last shutdown, the project is placed in `AWAITING_USER_INPUT` state. An amber banner appears on the Status tab — review the Handoff tab, then hit **Resume agent** to continue.

## Adding an agent adapter

1. Create `agents/<name>.adapter.js`
2. Export `start(context)` → `{ process, stdout, stderr }` and `stop(proc, killTimeoutMs)`
3. Add the adapter key to `DORCH_AGENTS` in `.env`

See `docs/07-cli-adapters.md` for the full interface.

## Docs

| Doc | Contents |
|-----|---------|
| `docs/00-project-brief.md` | What this is, MVP definition of done |
| `docs/02-system-architecture.md` | Module map, event bus, HTTP API |
| `docs/03-agent-workflow.md` | Full task lifecycle, git rules |
| `docs/04-switching-rules.md` | All six triggers, detection patterns, timeouts |
| `docs/05-memory-and-context.md` | Memory file schemas, context assembly |
| `docs/07-cli-adapters.md` | Adapter interface, prompt format |
| `docs/08-mvp-build-order.md` | Step-by-step build sequence |
| `docs/09-decisions.md` | All resolved design decisions |
| `docs/12-project-sprint-model.md` | Project → Sprint → Task hierarchy |

---

**License:**

This project is licensed for non-commercial use only. See the [LICENSE](LICENSE) file for full terms.
