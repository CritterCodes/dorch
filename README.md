# Dorch

Autonomous AI coding orchestrator. Runs Codex CLI and Claude CLI as interchangeable workers on a shared task. Automatically switches agents when one is blocked, rate-limited, or stuck.

## How it works

1. You submit a task via the mobile web UI
2. Dorch creates a plan and asks you to approve it
3. The first agent starts working on a task branch
4. If it hits a rate limit, stalls, or crashes — Dorch writes a handoff and starts the next agent
5. The new agent picks up from the handoff, no context lost
6. When tests pass and all steps are done, you approve a merge to main

## Prerequisites

- Node.js 20+
- `codex` installed and in PATH — `npm install -g @openai/codex`
- `claude` installed and in PATH — `npm install -g @anthropic-ai/claude-code`
- A git repo cloned into `data/workspace/target-repo/`

For local use, prefer each CLI's login flow instead of API keys:

```bash
codex login
claude auth login
```

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are optional overrides for API-key
auth. Leave them blank if you expect the CLIs to use stored account login.

## Setup

```bash
git clone <this repo> dorch
cd dorch
npm install
cp .env.example .env
# Edit .env — set DORCH_SESSION_SECRET and DORCH_SESSION_PASSWORD.
# API keys are optional when the CLIs are already logged in.
```

Clone your target repo into the workspace:

```bash
git clone <your project> data/workspace/target-repo
```

## Start

```bash
npm run mongo:up
npm start
```

Open `http://localhost:3000` on your phone (or desktop). Submit a task. Approve the plan. Watch it run.

For local development, `.env` must define `DORCH_SESSION_SECRET` and
`DORCH_SESSION_PASSWORD`. The server uses MongoDB at
`mongodb://localhost:27017/dorch`; `npm run mongo:up` starts it with Docker
Compose.

For production:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

## Mobile UI

The web UI is served at `http://<your-vps-ip>:3000`. Five screens:

| Screen | Purpose |
|--------|---------|
| Dashboard | Current agent, status, live output tail, quick actions |
| Live Logs | Full log stream, filterable by channel |
| Plan | Step-by-step plan, progress, approve button |
| Handoff | Latest handoff summary, history navigation |
| Switch | Manual agent switch with reason |

## Configuration

All config is via environment variables. See `.env.example` for the full list with defaults.

Key values:

| Variable | Default | Description |
|----------|---------|-------------|
| `DORCH_PORT` | `3000` | Web UI port |
| `DORCH_PRIMARY_AGENT` | `codex-cli` | First agent to use |
| `DORCH_NO_OUTPUT_TIMEOUT_MS` | `180000` | Switch after 3 min silence |
| `DORCH_MAX_RUNTIME_MS` | `2700000` | Switch after 45 min |
| `DORCH_MAX_SWITCHES_PER_TASK` | `6` | Pause after this many switches |
| `DORCH_TEST_COMMAND` | `npm test` | Run after agent signals STEP COMPLETE |

## Agent commit format

Agents commit to the task branch only, using this format:

```
agent(codex): add validators module
agent(claude): fix ESLint errors in auth/
```

Merging to `main` requires manual approval via the UI.

## Adding an agent adapter

1. Create `agents/<name>.adapter.js`
2. Export `start(context)`, `stop(proc)`, `formatContext(ctx)`
3. Add the name to `DORCH_AGENTS` in `.env`

See `docs/07-cli-adapters.md` for the full interface contract.

## Docs

Full implementation docs are in `docs/`. Start with `docs/08-mvp-build-order.md`.

| Doc | Contents |
|-----|---------|
| `00-project-brief.md` | What this is, MVP definition of done |
| `01-product-requirements.md` | Functional + non-functional requirements |
| `02-system-architecture.md` | Module map, event bus, HTTP API |
| `03-agent-workflow.md` | Full task lifecycle, git rules |
| `04-switching-rules.md` | All six triggers, detection patterns, timeouts |
| `05-memory-and-context.md` | Memory file schemas, context assembly |
| `06-file-structure.md` | Repo layout, naming conventions |
| `07-cli-adapters.md` | Adapter interface, prompt injection |
| `08-mvp-build-order.md` | Step-by-step build sequence |
| `09-decisions.md` | All resolved design decisions |
| `10-agent-prompts.md` | Exact prompt templates, detection patterns |
| `11-planner-chat.md` | Chat-based planner spec |
