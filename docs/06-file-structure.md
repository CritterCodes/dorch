# 06 — File Structure

## Repository Layout

```
dorch/
├── dorch.js                     Entry point. Wires all modules, starts HTTP server.
├── dorch-bus.js                 Shared EventEmitter instance. Imported by all modules.
├── config.js                    Configuration defaults + environment variable overrides.
├── package.json
│
├── server/
│   ├── index.js                 Express app. REST endpoints + SSE log stream. Serves ui/dist/.
│   └── ui/                      Vite + React PWA (separate package)
│       ├── package.json
│       ├── vite.config.js
│       ├── index.html           Vite entry HTML
│       ├── src/
│       │   ├── main.jsx         React entry point
│       │   ├── App.jsx          Root component + bottom-nav router
│       │   ├── components/      Shared UI components
│       │   └── screens/         One file per screen (Projects, Chat, Status, Logs, Plan, Handoff)
│       └── dist/                Built output — gitignored, served by Express as static files
│
├── agents/
│   ├── codex.adapter.js         Codex CLI adapter. start(), stop(), formatContext().
│   └── claude.adapter.js        Claude CLI adapter. start(), stop(), formatContext().
│
├── monitor/
│   ├── monitor.js               Stream watcher. Emits trigger events on the bus.
│   └── triggers.js              Regex patterns and timeout constants.
│
├── handoff/
│   └── handoff-manager.js       Writes sprint handoffs. Runs git diff --stat.
│
├── planner/
│   └── planner.js               Manages Planner conversation + writes sprint plan.
│
├── memory/
│   └── index.js                 All file I/O for project memory. No other module uses fs directly.
│
├── lib/
│   └── git.js                   Git utility. createBranch, mergeBranch, diffStat. Only module that shells out to git.
│
├── switch-controller/
│   └── index.js                 State machine. Listens for triggers, orchestrates switches.
│
├── executor/
│   └── index.js                 Spawns/kills agent processes. Assembles context.
│
├── projects/                    ← gitignored; created at runtime
│   └── <project-slug>/
│       ├── workspace/           Git clone of the project repo
│       ├── memory/
│       │   ├── project-brief.md
│       │   ├── project-summary.md
│       │   ├── current-sprint.md
│       │   ├── sprints/
│       │   │   ├── sprint-01.md
│       │   │   └── sprint-02.md
│       │   ├── latest-handoff.md
│       │   ├── handoff-history.md
│       │   ├── run-log.md
│       │   └── review-notes.md
│       └── planner/
│           ├── sprint-01-conversation.jsonl
│           └── current-conversation.jsonl
│
└── docs/
    ├── 00-project-brief.md
    ├── 01-product-requirements.md
    ├── 02-system-architecture.md
    ├── 03-agent-workflow.md
    ├── 04-switching-rules.md
    ├── 05-memory-and-context.md
    ├── 06-file-structure.md      ← this file
    ├── 07-cli-adapters.md
    ├── 08-mvp-build-order.md
    ├── 09-decisions.md
    ├── 10-agent-prompts.md
    ├── 11-planner-chat.md
    └── 12-project-sprint-model.md
```
---

## Module Responsibilities (one-line each)

| File | Responsibility |
|------|---------------|
| `dorch.js` | Entry point. Starts HTTP server, initializes memory for all project folders, holds `Map<slug, ProjectRuntime>` of active Switch Controller + Executor + Monitor instances. |
| `dorch-bus.js` | Export a single `new EventEmitter()` instance. Nothing else. |
| `config.js` | Export a frozen config object. Read from env vars with defaults. Validate required vars on startup — exit with a descriptive error if any are missing. |
| `server/index.js` | HTTP + SSE server. Translate HTTP requests into bus events or direct function calls. |
| `agents/codex.adapter.js` | Know how to start/stop codex-cli and format context for its CLI interface. |
| `agents/claude.adapter.js` | Same contract as codex adapter, different CLI. |
| `monitor/monitor.js` | Attach to agent streams, emit trigger events, maintain output buffer and timestamps. |
| `monitor/triggers.js` | Export regex patterns and numeric timeout constants. No logic. |
| `handoff/handoff-manager.js` | Write handoff files from run state. Run `git diff --stat`. |
| `planner/planner.js` | Parse task string, inspect workspace, write global-plan.md and current-task.md. |
| `memory/index.js` | File reads/writes for agent-readable context only (briefs, summaries, handoffs). No MongoDB here. |
| `db/index.js` | Mongoose connection. Exports Project, Sprint, Session models. |
| `db/models/project.js` | Project schema: slug, name, repoUrl, createdAt, archivedAt. |
| `db/models/sprint.js` | Sprint schema: projectSlug, n, goal, status, branch, createdAt, closedAt. |
| `db/models/planner-message.js` | PlannerMessage schema: projectSlug, sprintN, from ('user'\|'planner'), text, ts. |
| `lib/git.js` | Git utility. `createBranch`, `mergeBranch`, `currentBranch`, `diffStat`. Only module that shells out to git. |
| `switch-controller/index.js` | Own state machine. Coordinate stop → handoff → start sequence. |
| `executor/index.js` | Spawn/kill agent child processes. Assemble context from memory. Return streams to monitor. |

---

## Naming Conventions

- Files: `kebab-case.js`
- Functions: `camelCase`
- Events on the bus: `noun:verb` (e.g. `agent:started`, `trigger:received`, `handoff:written`)
- Memory file events logged to run-log: `[noun:verb]` in brackets with ISO timestamp prefix
- Config keys: `camelCase`
- Environment variables: `UPPER_SNAKE_CASE` with prefix `DORCH_` (e.g. `DORCH_PORT`, `DORCH_NO_OUTPUT_TIMEOUT_MS`)

---

## Configuration (config.js)

Environment variable → config key mapping:

**Required — process exits with a clear error message if missing:**
```
DORCH_SESSION_SECRET         config.sessionSecret            (no default — must be set)
DORCH_SESSION_PASSWORD       config.sessionPassword          (no default — the single login password)
```

**Optional with defaults:**
```
DORCH_PORT                   config.port                     default: 3000
DORCH_MONGO_URI              config.mongoUri                 default: 'mongodb://localhost:27017/dorch'
DORCH_SESSION_MAX_AGE_MS     config.sessionMaxAgeMs          default: 604800000  (7 days)
DORCH_PRIMARY_AGENT          config.primaryAgent             default: 'codex-cli'
DORCH_AGENTS                 config.agents (comma-separated) default: 'codex-cli,claude-cli'
DORCH_NO_OUTPUT_TIMEOUT_MS   config.noOutputTimeoutMs        default: 180000     (3 min)
DORCH_MAX_RUNTIME_MS         config.maxRuntimeMs             default: 2700000    (45 min)
DORCH_MAX_SWITCHES           config.maxSwitchesPerTask       default: 6
DORCH_KILL_TIMEOUT_MS        config.killTimeoutMs            default: 5000
DORCH_REQUIRE_PLAN_APPROVAL  config.requirePlanApproval      default: false
DORCH_SPRINT_BRANCH_PREFIX   config.sprintBranchPrefix       default: 'agent/sprint-'
DORCH_DEFAULT_REMOTE_TEMPLATE config.defaultRemoteTemplate   default: ''
DORCH_TEST_COMMAND           config.testCommand              default: 'npm test'
```

---

## Runtime Data

The `projects/` directory is gitignored and created at runtime — one subfolder per project. Add to `.gitignore`:

```
projects/
```

`memory/index.js` creates the full project folder tree (`workspace/`, `memory/`, `planner/`) when a project is first created. Dorch handles cloning or `git init` — no manual setup needed.

MongoDB data lives outside the repo. Provide a connection string via `DORCH_MONGO_URI`. For local dev, `mongodb://localhost:27017/dorch` is the default.

---

## Process Entry Point

```
node dorch.js
```

For production deployment, wrap with PM2:

```
pm2 start dorch.js --name orch --restart-delay 2000
```

Server code: no build step. Node 20+ native ESM or CommonJS only.
Frontend: `npm run build` in `server/ui/` compiles the Vite + React PWA to `server/ui/dist/`, which Express serves as static files.

---

## Adding a New Agent Adapter

1. Create `agents/<name>.adapter.js`
2. Export: `start(context) → { process, stdout, stderr }`, `stop(process) → Promise<void>`, `formatContext(contextObj) → string | Buffer`
3. Add the adapter name to `config.agents`
4. The Switch Controller picks it up automatically on next rotation

No changes required to any other module.
