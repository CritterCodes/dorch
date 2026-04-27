# 01 — Product Requirements

## Functional Requirements

### F1 — Task Intake
- User can submit a task as a plain text string via the mobile UI or a CLI command
- The task string is passed to the Planner, which writes a structured plan with acceptance criteria to `memory/global-plan.md`
- The plan must be readable by a coding agent without additional context
- Plan approval is **always required** before the first agent starts — this is not a config flag in MVP
- Dorch creates a task branch (`agent/task-<id>`) before starting any agent

### F2 — Agent Execution
- The system must support at least two agent adapters: `codex-cli` and `claude-cli`
- Each adapter must spawn the agent as a child process via `child_process.spawn`
- The agent must be given the global plan, current task step, and latest handoff as input context
- Context must be injected via CLI flags, stdin, or a temp file — whichever the CLI supports
- The agent must run inside the shared workspace directory (`workspace/target-repo/`)
- Only one agent may run at a time in MVP

### F3 — Monitor
- The monitor must receive all agent stdout and stderr as a stream (not buffered)
- The monitor must evaluate each chunk of output as it arrives
- The monitor must detect the following conditions:
  - Rate-limit or quota messages in stdout/stderr
  - Cooldown messages in stdout/stderr
  - Process exit with non-zero code
  - Process crash or signal termination
  - No output for a configurable duration (default: 45 seconds)
  - Total runtime exceeding a configurable maximum (default: 20 minutes)
- When a condition is detected, the monitor must emit a trigger event immediately — it must not wait for the process to finish

### F4 — Switch Controller
- The switch controller must listen for trigger events from the monitor and for manual override requests from the UI
- On receiving a trigger, it must:
  1. Signal the Executor to stop the current agent
  2. Signal the Handoff Manager to write a handoff summary
  3. Select the next agent (round-robin in MVP)
  4. Signal the Executor to start the next agent with updated context
- The first trigger received wins — subsequent triggers during a switch in progress must be ignored
- A switch must complete (new agent running or error logged) within 30 seconds

### F5 — Handoff Manager
- Must write `memory/latest-handoff.md` whenever an agent stops, for any reason
- Must append the same content to `memory/handoff-history.md`
- The handoff file must include:
  - `switch_reason` — one of: `rate_limit`, `cooldown`, `process_error`, `no_output_timeout`, `max_runtime`, `manual`
  - `from_agent` — which adapter was running
  - `task` — which step was being worked on
  - `completed` — what was finished (inferred from git diff + last output)
  - `git_diff` — summary of uncommitted changes (output of `git diff --stat`)
  - `uncertain` — anything ambiguous or unresolved
  - `last_output` — last 20 lines of stdout/stderr
  - `next_step` — recommended action for the next agent
- The handoff file must be written before the next agent starts

### F6 — Memory
- Six memory files must exist and be kept current (see `05-memory-and-context.md` for schema)
- Memory files are plain markdown — no database, no JSON in MVP
- All memory reads and writes must be synchronous file operations to avoid race conditions in MVP

### F7 — Mobile Web UI
- Must be served by Dorch's HTTP server on a configurable port (default: 3000)
- Must be usable on a phone browser without installing anything
- Must support the following actions:
  - Start a task (text input + submit)
  - Approve or reject the initial plan
  - Stop the current run
  - Trigger a manual agent switch
  - View current agent and status
  - View live log stream (SSE or WebSocket)
  - View `memory/latest-handoff.md`
  - View `memory/global-plan.md`
  - Approve merge of task branch into `main` (displays "Ready to merge" button when all tests pass; merge itself is manual in MVP)
- UI must not require a framework build step — plain HTML/JS or a single-file React/Babel approach is acceptable for MVP

### F9 — Git Branch Isolation
- On task start, Dorch must create a task branch: `git checkout -b agent/task-<id>` in the workspace
- All agent commits must land on the task branch only
- Dorch must not provide the agent with credentials or flags enabling commits to `main`
- Permitted agent git operations: `git add`, `git commit` (task branch only), `git diff`, `git log`, `git status`
- Prohibited agent git operations: merge to `main`, force push, branch deletion, history rewrite
- Commit message format must be enforced: `agent(<adapter>): <description>`

### F10 — Task Completion via Acceptance Criteria
- Acceptance criteria must be written into `global-plan.md` for each step at plan creation time
- A step is not complete until Dorch runs `config.testCommand` and receives exit code 0
- Dorch must run the test command automatically when an agent outputs `STEP COMPLETE`
- If tests fail, the agent continues on the same step — it is not switched and the step is not marked done
- Agents must not modify test files to force pass without logging the change in the handoff
- Task completion requires all steps marked `[x]` and a final passing test run

### F8 — Run Log
- Every significant event must be appended to `memory/run-log.md` with a timestamp
- Events include: task started, agent started, agent stopped, switch triggered (with reason), switch completed, task completed, errors

---

## Non-Functional Requirements

### NF1 — No blocking I/O on agent streams
Agent stdout/stderr must never be buffered in a way that blocks the monitor from receiving output in real time.

### NF2 — Agent processes must be killable
Dorch must be able to SIGTERM (then SIGKILL after 5s) an agent at any time without hanging.

### NF3 — Memory files are the source of truth
Dorch must be able to restart from cold (process restart, VPS reboot) and resume from the current state of memory files.

### NF4 — No lost handoffs
If Dorch crashes mid-switch, the handoff file written before the crash must still be valid and usable when Dorch restarts.

### NF5 — Concurrency is single-agent only
No parallel agent execution in MVP. This simplifies all state management.

### NF6 — Deployment target
Single VPS, SSH access, systemd or PM2 process management. No Docker required for MVP.

---

## Out of Scope (Explicit)

- OAuth, user accounts, or multi-user support
- Any form of automated code review
- GitHub API integration
- Model cost tracking
- Retry logic beyond a single agent switch
- Any LLM API calls from Dorch itself (Dorch does not call APIs — the CLI agents do)
