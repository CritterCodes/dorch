# Dorch

Dorch is a VPS-hosted orchestrator that runs multiple AI coding agents (Codex CLI and Claude CLI) against a shared task. Agents are interchangeable workers — Dorch manages the plan, memory, handoffs, and switching so work continues uninterrupted.

## Start here

Read the docs in this order before writing any code:

1. `docs/00-project-brief.md` — what this is and what done looks like
2. `docs/12-project-sprint-model.md` — Project > Sprint > Task hierarchy (read before architecture)
3. `docs/08-mvp-build-order.md` — strict build sequence (follow this exactly)
4. `docs/02-system-architecture.md` — module map and event bus
5. `docs/09-decisions.md` — all resolved design decisions (canonical)
6. Other docs as needed per phase

## Key rules

- Build one phase at a time. Verify each phase before starting the next.
- Do not write two unproven layers at once.
- All memory file access goes through `memory/index.js` only. No direct `fs` calls elsewhere.
- All inter-module communication uses `dorch-bus.js` (shared EventEmitter) or direct function calls.
- MongoDB for structured metadata (projects, sprints, sessions, run logs). No LLM API calls from the orchestrator itself. CLI agents make the API calls.
- Agent-readable context (project-brief, project-summary, handoffs, sprint summaries) stays as markdown files on disk. Agents cannot query MongoDB.
- Agents run on a sprint branch (`agent/sprint-<N>-<slug>`), never on `main`.

## File naming

- Entry point: `dorch.js`
- Event bus: `dorch-bus.js`
- Config: `config.js`
- Env vars prefixed: `DORCH_`
- Agent commit format: `agent(<adapter>): <description>`

## Timeouts (do not hardcode other values)

- No-output timeout: 180000ms (3 min)
- Max runtime: 2700000ms (45 min)
- Kill grace period: 5000ms

## Trigger priority (P1 = highest)

1. manual
2. process_error
3. blocked (agent outputs `BLOCKED: <reason>`)
4. rate_limit
5. no_output_timeout
6. max_runtime

## Step completion

Agent signals `STEP COMPLETE` (case-insensitive, also accepts `STEP DONE`).
Orchestrator then runs `config.testCommand`. Step only advances if exit code is 0.

## Context size limits

- Never pass `handoff-history.md` to agents
- Handoff trimmed to 4800 chars max (preserve `### Next Step` and `### Last Output`)
- Total context cap: 32000 chars

## Where to put things

```
dorch/
  dorch.js              entry point
  dorch-bus.js          shared EventEmitter
  config.js             config + env var mapping
  agents/               CLI adapters
  monitor/              stream watcher + trigger patterns
  handoff/              handoff file writer
  planner/              planner conversation + plan writer
  memory/               file I/O for agent-readable context only
  db/                   MongoDB connection + Mongoose models
  switch-controller/    state machine
  executor/             spawn/kill agents, assemble context
  server/               HTTP + SSE + mobile UI + auth middleware
  projects/             one folder per project (gitignored)
    <slug>/
      workspace/        git clone of target repo
      memory/           project memory files
      planner/          conversation archives
  docs/                 implementation docs (read before coding)
```

## Work model

- **Project** — persistent entity, own folder + repo
- **Sprint** — branch + conversation + set of tasks; one active at a time
- **Task** — individual step worked by agents
- Sprint closes on merge; sprint summary written at close
- Planner conversation is persistent per sprint (not one-shot)
- Context at sprint start: project-brief + project-summary + sprint goal + current task + latest handoff (~1200 tokens)
- Previous sprints are NOT loaded into agent context — only the sprint summary
