# 03 — Agent Workflow

## Overview

This document describes the full lifecycle of a single agent run — from plan approval through to sprint completion or failure. It covers what happens at each step, what is read/written, and what the next step expects.

By the time agents start, the sprint already exists: the Planner conversation has run via claude-cli, `current-sprint.md` and `current-task.md` are written, and the sprint branch `agent/sprint-<N>-<slug>` has been created in the workspace.

---

## Step 1 — Plan Approval (First Agent Start)

**Trigger:** User approves the sprint plan via the Chat UI (`approvePlan(slug)` is called). State transitions `IDLE → RUNNING`.

**What already exists at this point:**
- `projects/<slug>/memory/current-sprint.md` — sprint goal + full task list with acceptance criteria
- `projects/<slug>/memory/current-task.md` — first task, written by Planner
- `projects/<slug>/memory/latest-handoff.md` — placeholder ("No prior handoff")
- Branch `agent/sprint-<N>-<slug>` checked out in `projects/<slug>/workspace/`

**Actions:**
1. Switch Controller selects the first agent (default: `codex-cli`, configurable via `config.primaryAgent`)
2. Executor calls `memory.assembleContext(slug)` to collect all context files
3. Executor calls the adapter's `start(context)` function
4. Adapter formats the context and spawns the CLI process with `cwd` set to `projects/<slug>/workspace/`
5. Adapter returns `{ process, stdout, stderr }` to the Executor
6. Executor pipes stdout and stderr to the Monitor
7. Monitor records `agentStartedAt` and `lastOutputAt`
8. Dorch appends `[agent:started] <adapter>` to `projects/<slug>/memory/run-log.md`

If `config.requirePlanApproval` is `false` (default), the first agent starts automatically after `approvePlan()`. If `true`, state waits at `AWAITING_APPROVAL` until the user confirms.

---

## Step 2 — Agent Working

**Normal operation:** Agent runs, reads and writes files in the workspace, emits output. The Monitor receives all output and checks each chunk against trigger patterns.

**The Monitor does:**
- Updates `lastOutputAt = Date.now()` on every chunk received
- Checks each chunk against `triggers.RATE_LIMIT`, `triggers.BLOCKED`, and `triggers.CONTEXT_FULL` regexes
- Checks each chunk against `triggers.STEP_COMPLETE` regex
- Keeps a rolling buffer of the last 20 output lines for handoff capture
- Polls every 30 seconds to check no-output timeout and max-runtime timeout

**The HTTP server does:**
- Forwards all output lines to the SSE stream at `GET /projects/:slug/logs/stream`

**What the agent is expected to do:**
- Read and edit files in `projects/<slug>/workspace/`
- Run tests via shell
- Stage and commit changes: `agent(<adapter>): <description>`
- Emit progress to stdout so the monitor can confirm it is alive
- Output `STEP COMPLETE` when the current task is done and tests pass
- Output `BLOCKED: <reason>` if it cannot proceed

---

## Step 2a — STEP COMPLETE Detected (mid-run)

**Trigger:** Monitor detects `STEP COMPLETE` (or accepted variant) in agent output.

This runs inside the normal agent run — the agent is still alive. The Switch Controller handles it:

1. Monitor emits `step:signal` on the bus: `{ slug }`
2. Switch Controller (still in `RUNNING` state) runs `config.testCommand` in `projects/<slug>/workspace/`
3. **If exit code 0:**
   - Calls `memory.writeCurrentSprint(slug, ...)` to mark the current task `[x]`
   - Calls `memory.writeCurrentTask(slug, ...)` with the next task
   - If all tasks are now `[x]`: emits `sprint:complete` on the bus, transitions to `IDLE`, stops the agent gracefully
   - If tasks remain: emits `step:complete` on the bus — agent continues to the next task
4. **If exit code non-zero:**
   - Does nothing — agent continues working on the same task
   - Logs `[warn:tests_failed] step_complete_signal_ignored` to run-log

The agent is never killed by a passing STEP COMPLETE — it continues running and picks up the next task from context (or exits naturally if it reads the updated `current-task.md`). The agent is only stopped when all tasks are done.

---

## Step 3 — Trigger Detected

**Trigger:** Monitor detects one of the six conditions (see `04-switching-rules.md`).

**Actions:**
1. Monitor emits a `trigger` event on the bus: `{ type, raw }`
2. Switch Controller receives the event
3. If state is `SWITCHING`, the trigger is dropped — switch already in progress
4. If state is `RUNNING`, Switch Controller transitions to `SWITCHING`
5. Switch Controller sets `monitor.switching = true` to suppress further triggers from the closing process
6. Switch Controller calls `executor.stopAgent()` — sends SIGTERM, waits up to `config.killTimeoutMs` (5s), then SIGKILL
7. In parallel, Monitor captures the last output buffer and `git.diffStat(slug)` for the handoff

---

## Step 4 — Handoff Written

**Trigger:** `executor.stopAgent()` resolves (process has exited).

The Switch Controller calls `handoffManager.write(runState)` where `runState` is:

```js
{
  slug: string,          // project slug — determines all file paths
  fromAdapter: string,   // 'codex-cli' or 'claude-cli'
  switchReason: string,  // trigger type that caused the switch
  lastOutputBuffer: string[], // last 20 lines from monitor's rolling buffer
}
```

**Actions:**
1. Handoff Manager reads `projects/<slug>/memory/current-task.md` via `memory.readCurrentTask(slug)`
2. Handoff Manager calls `git.diffStat(slug)` to get the file change summary
3. Assembles the handoff from `runState` + task + diff
4. Calls `memory.writeLatestHandoff(slug, handoffText)`
5. Calls `memory.appendHandoffHistory(slug, handoffText)`
6. Emits `handoff:written` on the bus: `{ slug, path: 'projects/<slug>/memory/latest-handoff.md' }`

**Crash safety:** If Dorch crashes before this step, the previous `latest-handoff.md` remains valid. The next agent start will use it.

---

## Step 5 — Next Agent Start

**Trigger:** `handoff:written` event received by Switch Controller.

**Actions:**
1. Switch Controller selects the next agent (round-robin — see `04-switching-rules.md`)
2. Executor calls `memory.assembleContext(slug)` — re-reads all files from disk. Task advancement (if the previous agent completed a step before being switched) is already reflected in `current-sprint.md` and `current-task.md` from Step 2a.
4. Executor calls the next adapter's `start(context)` function
5. Monitor resets `agentStartedAt` and `lastOutputAt`, sets `monitor.switching = false`
6. State transitions `SWITCHING → RUNNING`
7. Dorch appends `[switch:complete] from=<prev> to=<next> reason=<type>` to run-log

---

## Step 6 — Sprint Completion

**Completion is contract-driven, not confidence-driven.** An agent outputting "I'm done" is not sufficient.

**How step completion is detected:**
1. Agent outputs `STEP COMPLETE` (or accepted variant — see `10-agent-prompts.md`)
2. Dorch runs `config.testCommand` in the workspace
3. Exit code 0 → step is accepted; Switch Controller marks the task `[x]` in `current-sprint.md` and advances `current-task.md`
4. Exit code non-zero → step is NOT accepted; agent continues on the same step

**Sprint complete when:**
- All tasks in `current-sprint.md` are marked `[x]`
- Final test run passes

**On sprint complete:**
1. Executor stops the current agent gracefully (SIGTERM)
2. Handoff Manager writes a final handoff with `reason: complete`
3. State transitions `RUNNING → IDLE`
4. Dorch appends `[sprint:complete] sprint-<N>` to run-log
5. UI is notified via SSE: `{ type: 'sprint:complete' }`
6. Sprint status in Mongo is set to `REVIEW` — awaiting user close + merge

**Agent constraint:** Agents may not modify tests to force them to pass without logging the change. Any test file modification must appear in the handoff under `### Files Changed` with a reason.

---

## Git Rules

Agents on the sprint branch may:
- Read and edit files in the workspace
- Run tests via shell
- Stage changes (`git add`)
- Commit to the sprint branch: `agent(<adapter>): <description>`

Agents must not:
- Commit to `main`
- Merge into `main`
- Force push
- Delete branches
- Rewrite history (`rebase`, `reset --hard`, `amend` on pushed commits)

Dorch enforces the branch constraint at spawn time by setting `cwd` to the workspace with the sprint branch already checked out.

---

## Crash Recovery

On orchestrator startup, for each project folder under `projects/`, read `memory/run-log.md` from the bottom:

- Last entry is `[sprint:complete]` or no `[agent:started]` found → stay `IDLE`
- Last entry is `[agent:started]` with no `[sprint:complete]` following → assume interrupted; start next agent from `latest-handoff.md`
- If `latest-handoff.md` contains "No prior handoff" → restart from the beginning of `current-task.md`

---

## Concurrency Notes

- Only one agent runs at a time per project
- The Switch Controller is the only component that may transition state
- All memory file writes go through `memory/index.js` — no direct `fs` calls elsewhere
- All git operations go through `lib/git.js` — no direct `child_process` git calls elsewhere
- The Monitor must not be active while no agent is running — unsubscribe from bus on agent stop
