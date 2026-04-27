# 02 — System Architecture

## Process Model

Dorch is a single Node.js process. It has no separate worker processes of its own. The coding agents (codex-cli, claude-cli) run as child processes spawned by per-project Executors.

**Multi-project model:** Each active project gets its own set of scoped module instances. The HTTP server, Planner, Memory Layer, and Handoff Manager are stateless (slug-scoped functions) — they are shared. The Executor, Monitor, and Switch Controller are stateful — one instance per active project, created when a project's first sprint starts and held in a `Map<slug, ProjectRuntime>` in `dorch.js`.

```
orchestrator (Node.js process)
├── HTTP server              — serves mobile UI, SSE log stream (shared)
├── Planner                  — sprint planning via claude-cli (shared, slug-scoped)
├── Handoff Manager          — writes handoff files (shared, slug-scoped)
├── Memory Layer             — file I/O wrapper (shared, slug-scoped)
├── db/                      — MongoDB connection + models (shared)
└── ProjectRuntime (per active project, held in Map<slug, ProjectRuntime>)
    ├── Switch Controller    — state machine for this project
    ├── Executor             — spawns/kills agents for this project
    │   └── agent (child)    — codex-cli or claude-cli
    └── Monitor              — watches agent streams for this project
```

Multiple projects can run agents simultaneously — each in its own `ProjectRuntime`. One active sprint per project at a time; one agent running per sprint at a time.

## Module Boundaries

Each module is a plain Node.js module (CommonJS or ESM, pick one and be consistent). No classes required — exported functions are fine. Modules communicate by calling each other's functions and by emitting/listening to a shared EventEmitter instance (`orchestrator-bus`).

### dorch.js
- Entry point
- Instantiates all modules
- Wires up the event bus
- Starts the HTTP server
- Does not contain business logic

### agents/codex.adapter.js
- Knows how to start and stop codex-cli
- Returns a running process handle + stdout/stderr streams
- Accepts a context object, formats it for codex-cli's input method
- Does not contain switch logic

### agents/claude.adapter.js
- Same interface as codex.adapter.js
- Knows how to start and stop claude-cli
- Formats context for claude-cli's input method

### monitor/monitor.js
- Accepts a readable stream (stdout/stderr merged or separate)
- Emits trigger events on Dorch-bus
- Maintains a last-output timestamp for no-output timeout
- Maintains a start timestamp for max-runtime timeout
- Does not decide what to do about triggers — just emits them

### monitor/triggers.js
- Exports regex patterns for rate-limit and cooldown detection
- Exports timeout constants (no_output_ms, max_runtime_ms)
- Stateless — pure configuration

### lib/git.js
- Thin wrapper around `child_process.execSync` for git operations in a project workspace
- All functions accept `slug` as first argument; resolve the workspace path internally
- Exports: `createBranch(slug, branchName)`, `mergeBranch(slug, branch, into)`, `currentBranch(slug)`, `diffStat(slug)`
- The only module allowed to run git commands. Route handlers and the Handoff Manager call these functions — they do not shell out to git directly

### planner/planner.js
- Spawns claude-cli in a short-lived planning session (not through Executor)
- Passes project context + conversation history on each invocation
- Captures claude-cli output, appends each turn to `current-conversation.jsonl`
- When plan is ready, claude-cli writes `current-sprint.md` and `current-task.md`; Planner returns `planReady: true`
- Does not run through Monitor or Switch Controller — invoked directly by HTTP route handlers

### handoff/handoff-manager.js
- Accepts a reason code, current run state, and project slug
- Reads `git diff --stat` from `projects/<slug>/workspace/`
- Writes `projects/<slug>/memory/latest-handoff.md`
- Appends to `projects/<slug>/memory/handoff-history.md`
- Returns a promise that resolves when both writes are complete

### memory/index.js (Memory Layer)
- All functions accept a project slug as first argument — paths resolve to `projects/<slug>/memory/`
- All reads return strings (raw markdown)
- All writes are synchronous (fs.writeFileSync) to prevent partial-write race conditions
- Exports: initProject, readProjectBrief, writeProjectBrief, readProjectSummary, writeProjectSummary, readCurrentSprint, writeCurrentSprint, readSprintSummary, writeSprintSummary, readCurrentTask, writeCurrentTask, readLatestHandoff, writeLatestHandoff, appendHandoffHistory, appendRunLog, readRunLog, readReviewNotes, writeReviewNotes

### server/index.js (HTTP + UI server)
- Serves static mobile UI files
- Exposes REST endpoints for UI actions (start, stop, switch)
- Exposes an SSE endpoint at `/logs/stream` for live log output
- Reads memory files on demand to serve to the UI

## Event Bus

Use a single Node.js EventEmitter instance exported from `dorch-bus.js`. All inter-module communication that is not a direct function call goes through this bus.

Events emitted:

| Event | Emitter | Payload |
|-------|---------|---------|
| `trigger` | Monitor | `{ type: 'rate_limit' \| 'blocked' \| 'process_error' \| 'no_output_timeout' \| 'max_runtime' \| 'manual', raw?: string }` |
| `agent:started` | Executor | `{ adapter: string, pid: number }` |
| `agent:stopped` | Executor | `{ adapter: string, code: number \| null, signal: string \| null }` |
| `handoff:written` | Handoff Manager | `{ slug: string, path: string }` |
| `step:signal` | Monitor | `{ slug: string }` — emitted when STEP COMPLETE detected in output; Switch Controller runs test command in response |
| `step:complete` | Switch Controller | `{ slug: string, taskN: number }` — emitted when tests pass; agent continues to next task |
| `sprint:updated` | Planner | `{ slug: string }` — emitted by `updateSprint()` after rewriting `current-sprint.md`; Switch Controller re-reads the file on next agent start |
| `sprint:complete` | Switch Controller | `{ slug: string }` — emitted when all tasks marked complete and final tests pass |
| `log:line` | Monitor | `{ slug: string, source: 'stdout' \| 'stderr', text: string, ts: number }` |

## State Machine

The Switch Controller owns the following states:

```
IDLE → AWAITING_APPROVAL → RUNNING → SWITCHING → RUNNING → ... → IDLE
                                 ↓                                  ↑
                          AWAITING_USER_INPUT ──── resume ──────────┘
                          AWAITING_COOLDOWN   ──── auto ────────────┘
```

- `IDLE` — no agent running, no sprint active
- `AWAITING_APPROVAL` — plan written, waiting for user to approve before first agent starts (only when `config.requirePlanApproval = true`)
- `RUNNING` — agent is running, monitor is active
- `SWITCHING` — switch in progress (killing agent, writing handoff, starting next)
- `AWAITING_USER_INPUT` — hard limit reached (max switches or consecutive failures); requires `POST /projects/:slug/agent/resume` to continue
- `AWAITING_COOLDOWN` — all agents rate-limited; polls every 30s and auto-resumes when a cooldown window clears

Transitions:
- `IDLE + plan_approved` → `AWAITING_APPROVAL` (if `requirePlanApproval`) or `RUNNING` (default)
- `AWAITING_APPROVAL + user_approved` → `RUNNING`
- `RUNNING + trigger` → `SWITCHING`
- `SWITCHING + handoff_written + new_agent_started` → `RUNNING`
- `SWITCHING + limit_reached` → `AWAITING_USER_INPUT`
- `SWITCHING + all_rate_limited` → `AWAITING_COOLDOWN`
- `AWAITING_USER_INPUT + resume` → `RUNNING`
- `AWAITING_COOLDOWN + cooldown_cleared` → `RUNNING`
- `RUNNING + sprint_complete` → `IDLE`

Only one transition may be in progress at a time. Triggers received while in `SWITCHING` state are dropped.

## Context Assembly

Before each agent start, the Executor assembles a context object by reading from `projects/<slug>/memory/`:

1. `project-brief.md` — what this project is (~200 tokens)
2. `project-summary.md` — current architecture + key decisions (~300 tokens)
3. `current-sprint.md` — active sprint goal + status (~100 tokens)
4. `current-task.md` — the specific task for this agent run (~200 tokens)
5. `latest-handoff.md` — previous agent's summary, trimmed to 4800 chars (~400 tokens)

Total baseline: ~1200 tokens. Previous sprint summaries are not loaded automatically — only the current sprint context is injected.

This object is passed to the adapter, which formats it into whatever the CLI expects (flag, stdin, temp file).

## HTTP API (MVP)

All endpoints are unauthenticated in MVP. Add auth before exposing to the public internet.

```
POST /projects/create                      body: { name, repoUrl? }
GET  /projects                             returns: list of projects
GET  /projects/:slug                       returns: project detail + sprint list

POST /projects/:slug/sprints/create        body: { goal }
GET  /projects/:slug/sprints/:n            returns: sprint detail + task list
POST /projects/:slug/sprints/:n/close      body: {}  → runs closeSprint(): compresses conversation,
                                                       writes sprints/sprint-N.md, updates project-summary.md,
                                                       sets status REVIEW. Returns { summary } for user review.
POST /projects/:slug/sprints/:n/merge      body: {}  → user confirms after reviewing summary. Merges sprint
                                                       branch into main via git.mergeBranch(), archives
                                                       current-conversation.jsonl → sprint-N-conversation.jsonl,
                                                       sets status CLOSED.

POST /projects/:slug/planner/message       body: { text }
GET  /projects/:slug/planner/messages      returns: current conversation thread

POST /projects/:slug/agent/switch          body: { reason?: string }
POST /projects/:slug/agent/stop            body: {}
POST /projects/:slug/agent/resume          body: {}  → resumes from AWAITING_USER_INPUT or AWAITING_COOLDOWN
GET  /projects/:slug/status                returns: { state, activeAgent, currentTask, sprintN }
GET  /projects/:slug/logs/stream           SSE — emits log:line events as text/event-stream

POST /auth/login                           body: { password } → sets session cookie
POST /auth/logout                          clears session cookie
```

All `/projects/*` routes require a valid session. Return 401 if no session cookie present.

## Dependency Constraints

- **Database:** MongoDB via Mongoose. Models: Project, Sprint, PlannerMessage. Used for structured metadata only — projects, sprints, sessions, planner conversation turns (for UI queries). Agent-readable context stays as markdown files on disk.
- **Auth:** `express-session` + `connect-mongo` (session store). Single password from env. No user table.
- **Frontend:** Vite + React, built to `dist/`, served as static files by Express. PWA manifest + service worker.
- No LLM SDK (Dorch never calls an AI API directly)
- No transpilation for server code — write for Node.js 20+ native ESM or CommonJS
- Server dependencies: `express`, `mongoose`, `express-session`, `connect-mongo`. Nothing else unless unavoidable.
- If a web framework is needed for the HTTP server, use Express only — no Fastify, Hapi, etc.
