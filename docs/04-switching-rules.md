# 04 — Switching Rules

## Overview

The Switch Controller applies a first-trigger-wins model. The first condition that fires causes an immediate switch. Subsequent triggers during an in-progress switch are dropped. Precision is not the goal — preventing the workflow from getting stuck is.

---

## Trigger Priority Order

When multiple conditions could theoretically fire at the same time, the Switch Controller processes them in this order. In practice, only the first one received matters because state moves to `SWITCHING` immediately.

| Priority | Trigger Type | Source | Condition |
|----------|-------------|--------|-----------|
| P1 | `manual` | Mobile UI | User presses "Switch Agent" |
| P2 | `process_error` | Monitor | Agent process exits with non-zero code or is killed by a signal |
| P3 | `blocked` | Monitor | Agent outputs a line starting with `BLOCKED:` |
| P4 | `rate_limit` | Monitor | stdout/stderr matches rate-limit or cooldown pattern |
| P5 | `no_output_timeout` | Monitor | No output received for `NO_OUTPUT_TIMEOUT_MS` (default: 180000 = 3 min) |
| P6 | `max_runtime` | Monitor | Agent has been running for `MAX_RUNTIME_MS` (default: 2700000 = 45 min) |

Priority order matters only for logging and the `switch_reason` field in the handoff. The Switch Controller does not delay or queue — the first event received triggers the switch.

---

## Detection: Rate Limit and Cooldown (P3)

The monitor checks every chunk of stdout/stderr against these exact strings (case-insensitive):

```
"rate limit"
"rate_limit"
"too many requests"
"quota exceeded"
"429"
"please wait"
"cooldown"
"retry after"
"your account has been limited"
"usage limit reached"
```

Implementation in `monitor/triggers.js`:

```
RATE_LIMIT: /rate.?limit|too many requests|quota.?exceeded|429|please wait|cooldown|retry after|account.*limited|usage limit/i
```

Both rate-limit and cooldown strings map to trigger type `rate_limit` — treated identically. If matched, emit the trigger immediately without waiting for the process to exit.

Additional pattern to handle separately — context window full is a hard `process_error`, not a rate limit:
```
"context window"
"context length"
"maximum context"
```
These should map to trigger type `process_error`.

---

## Detection: Agent BLOCKED Signal (P3b)

If the agent outputs a line starting with `BLOCKED:`, treat it as an immediate switch trigger — higher priority than rate-limit, lower than manual override and process error.

Detection pattern in `monitor/triggers.js`:
```
BLOCKED: /^BLOCKED:/m
```

Trigger type: `blocked`. Switch reason written to handoff: `blocked`.

This is a first-class trigger — wire it into the Switch Controller alongside the other five. The BLOCKED reason should be extracted from the agent output and included in the handoff's `### Issues / Blockers` section.

Example agent output that triggers this:
```
BLOCKED: cannot find auth/validators.js — file does not exist in workspace
BLOCKED: unclear acceptance criteria for step 3, need clarification
BLOCKED: rate limit hit on external API during test run
```



The agent process handle emits a `close` event with `(code, signal)`.

- If `code !== 0` → emit `{ type: 'process_error', raw: 'exit code ' + code }`
- If `signal !== null` (e.g. SIGKILL, SIGTERM from external source) → emit `{ type: 'process_error', raw: 'signal ' + signal }`
- If `code === 0` → do NOT emit a trigger — treat as task completion signal

Note: When the Switch Controller kills an agent intentionally (SIGTERM/SIGKILL), the Monitor will receive the `close` event. The Switch Controller must set a flag (`switching: true`) before sending the kill signal so the Monitor does not double-trigger.

---

## Detection: No-Output Timeout (P4)

The Monitor updates `lastOutputAt = Date.now()` on every chunk of stdout or stderr.

A polling interval (every 30 seconds) checks:
```
if (Date.now() - lastOutputAt > NO_OUTPUT_TIMEOUT_MS && state === 'RUNNING') {
  emit trigger: no_output_timeout
}
```

Default: **3 minutes (180000ms)**. Configurable via `config.noOutputTimeoutMs`.

This catches agents that are alive (process has not exited) but silently stuck — e.g. waiting for user input, deadlocked, or thinking for too long.

---

## Detection: Max Runtime (P5)

The Monitor records `agentStartedAt = Date.now()` when the agent starts.

Same polling interval checks:
```
if (Date.now() - agentStartedAt > MAX_RUNTIME_MS && state === 'RUNNING') {
  emit trigger: max_runtime
}
```

Default: **45 minutes (2700000ms)**. Configurable via `config.maxRuntimeMs`.

This is a safety net to prevent any single agent run from consuming unbounded API quota. It is not an indication that anything went wrong — the next agent will pick up from the handoff.

---

## Switch Execution Sequence

When a trigger is received and state is `RUNNING`:

1. Set `state = SWITCHING`
2. Set `monitor.switching = true` (suppresses further triggers from the closing process)
3. Call `executor.stopAgent()`:
   - Send SIGTERM to agent process
   - Wait up to 5000ms for `close` event
   - If not closed, send SIGKILL
   - Resolve when process has exited
4. In parallel with step 3, begin collecting handoff data (last output buffer, git diff)
5. Call `handoffManager.write(triggerType, currentRunState)`
6. Wait for handoff write to complete
7. Call `switchController.selectNextAgent()` — returns next adapter name
8. Update `memory/current-task.md` if previous step was completed
9. Call `executor.startAgent(nextAdapter, context)`
10. Set `monitor.switching = false`
11. Set `state = RUNNING`
12. Append to run log: `[switch:complete] from=<prev> to=<next> reason=<type>`

Total time budget for steps 1–11: 30 seconds. Log a warning if exceeded.

---

## Agent Selection (Round-Robin)

In MVP, the Switch Controller maintains a list of configured agents:

```
config.agents = ['codex-cli', 'claude-cli']
```

On each switch, select the next agent in the list. Wrap around when reaching the end.

**Rate-limit rule:** If the departing agent was rate-limited, always switch to the other agent — skip ahead in rotation if needed.

**Both agents rate-limited:** If all agents were rate-limited within the last `config.rateLimitCooldownMs` (default: 90000ms), do not switch. Set state to `AWAITING_COOLDOWN`. Poll every 30 seconds. Resume automatically when an agent's cooldown window has elapsed.

**Both agents failed:** If all agents have `process_error` as their last trigger and none are in cooldown, set state to `AWAITING_USER_INPUT`. Do not auto-resume.

If only one agent is configured, the same agent restarts after each switch. Valid for transient failures. Does not help with rate limits — configure two agents for rate-limit resilience.

---

## Preventing Infinite Switch Loops

Two hard limits. On either being reached, Dorch pauses and requires manual intervention — it does not auto-resume.

1. **Switch count limit per task:** `config.maxSwitchesPerTask` (default: **6**). If this many switches occur within a single task, set state to `AWAITING_USER_INPUT` and notify the UI. Do not start another agent.

2. **Consecutive failure limit:** `config.maxConsecutiveFailures` (default: **3**). If the same failure reason (e.g. `process_error`) fires on back-to-back switches without a step completing, pause and set state to `AWAITING_USER_INPUT`.

Both limits set state to `AWAITING_USER_INPUT`. The user must explicitly resume via the UI (`POST /projects/:slug/agent/resume`) or stop the task (`POST /projects/:slug/agent/stop`).

---

## Manual Override (P1)

The mobile UI sends `POST /projects/:slug/agent/switch` with an optional `{ reason: string }`.

The HTTP handler emits a `trigger` event with `{ type: 'manual', raw: reason || 'user override' }` on Dorch bus.

The Switch Controller handles this identically to any other trigger. The only difference is the `switch_reason` field in the handoff will read `manual`.

The UI should disable the switch button while `state === 'SWITCHING'` to prevent double-taps.

---

## Post-MVP: Stall Detection (Output Without Progress)

Not required for MVP. Add after the core switch loop is stable.

**Problem:** An agent can produce continuous output (avoiding the no-output timeout) while making no actual progress — e.g. repeatedly outputting `thinking...` or looping on the same error message without writing any files.

**Detection approach:**
- Track two separate timestamps: `lastOutputAt` (any output) and `lastProgressAt` (output containing a file path, a git operation, a test run, or a `STEP COMPLETE` signal)
- If `Date.now() - lastProgressAt > STALL_TIMEOUT_MS` and `state === 'RUNNING'`, emit trigger type `stall`
- Default: `STALL_TIMEOUT_MS = 600000` (10 min of output with no detectable progress)

**Progress indicators to track (any of these resets `lastProgressAt`):**
- Output contains a file path pattern: `/[a-z0-9_\-\/]+\.[a-z]{1,5}/i`
- Output contains `git `, `npm `, `node `, `yarn `, `pytest`, `cargo`, `make`
- Output contains `STEP COMPLETE` or `BLOCKED:`

This prevents the no-output timeout from being bypassed by a chatty but stuck agent.

---

## Configuration Reference

```
config.primaryAgent         string   'codex-cli'       First agent to use
config.agents               string[] [...]             Agent rotation list
config.noOutputTimeoutMs    number   180000            No-output trigger (3 min)
config.maxRuntimeMs         number   2700000           Max runtime per agent run (45 min)
config.maxSwitchesPerTask   number   6                 Hard loop limit — pauses on reach
config.maxConsecutiveFailures number 3                 Hard consecutive failure limit
config.rateLimitCooldownMs  number   90000             Cooldown window before agent is eligible again
config.killTimeoutMs        number   5000              SIGTERM → SIGKILL grace period
config.requirePlanApproval  boolean  false             Wait for user before first agent
```
