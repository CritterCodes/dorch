# 09 — Resolved Decisions

All eight open questions from the original spec have been resolved. This document is the canonical reference. Where a decision affects another doc, that doc has been updated to match.

---

## Decision 1 — Preventing agents from overwriting each other's work

**Rule:** One write-capable agent at a time. All agent work happens on a dedicated task branch, never on `main`.

**Branch strategy:**
```
main
  └── agent/sprint-<N>-<slug>    ← all agent commits for the sprint go here
```

**Branch slug definition:** `<slug>` is a slugified version of the sprint goal — lowercase, spaces replaced with hyphens, non-alphanumeric characters stripped, truncated to 30 characters. Example: `"Refactor auth module"` → `agent/sprint-01-refactor-auth-module`. Sprint number `<N>` is zero-padded to two digits and auto-incremented from the Sprint Mongo document count for that project.

Sprint branches are created at sprint start and merged to main when the user approves sprint close via the mobile UI.

**Sub-agent rule (MVP):**
- Primary agent: may edit files and commit to the task branch
- Sub-agents (future): may inspect, review, plan, summarize — no direct writes to shared workspace

**Parallel agent rule (post-MVP):**
Any sub-agent that writes code must operate in an isolated branch or worktree. Changes must be reviewed before merging into the task branch.

**Impact on:** `03-agent-workflow.md`, `01-product-requirements.md`

---

## Decision 2 — Handoff summary detail level

**Rule:** Structured and concise. Target 500–800 tokens. No paragraphs. Fixed headings.

**Required handoff format:**
```markdown
## Handoff

Agent: <adapter name>
Reason: <switch_reason>
Task: <current step description>

### Completed
- <bullet per completed item>

### In Progress
- <partial work with file/function context>

### Files Changed
- <file path>: <what changed>

### Issues / Blockers
- <known issue or uncertainty>

### Last Relevant Output
<short console excerpt — max 10 lines>

### Next Recommended Step
<one clear action for the next agent>
```

**Impact on:** `05-memory-and-context.md`

---

## Decision 3 — How task completion is determined

**Rule:** Contract-driven / TDD-style. A task is complete when all acceptance criteria pass, not when an agent says it is done.

**Completion flow:**
```
Plan → Acceptance Criteria → Tests → Implementation → Passing Tests → Complete
```

**A task is complete when:**
1. Acceptance criteria exist (written in `global-plan.md`)
2. Tests are written or identified for those criteria
3. Implementation satisfies the acceptance criteria
4. All relevant tests pass
5. No critical runtime errors remain

**Agent constraint:** Agents may not modify tests to make them pass without explicit logging. Test changes must appear in the handoff under `### Files Changed` with a note explaining why the test was changed.

**Completion signal in MVP:** Agent outputs `STEP COMPLETE` to stdout when it believes a step is done. Dorch does not automatically accept this — it runs the test command (`config.testCommand`) and checks the exit code. If tests pass, the step is marked complete. If not, the agent continues.

**Impact on:** `03-agent-workflow.md`, `01-product-requirements.md`

---

## Decision 4 — Preventing infinite switching loops

**Hard limits:**
```
maxSwitchesPerTask       = 6
maxConsecutiveFailures   = 3
```

**On limit reached:** Pause system. Set state to `AWAITING_USER_INPUT`. Notify via UI. Do not auto-resume.

**Both agents rate-limited:** If the switch would land on an agent that was rate-limited within the last `config.rateLimitCooldownMs` (default: 90000ms), pause and wait for cooldown rather than switching. Do not loop.

**Impact on:** `04-switching-rules.md`

---

## Decision 5 — Next agent selection

**Rule:** Round-robin in MVP.
```
codex-cli → claude-cli → codex-cli → claude-cli
```

**Rate-limit rule:** If the departing agent was rate-limited, always switch to the other agent (skip ahead in rotation if needed).

**Both rate-limited rule:** If all agents are rate-limited or have failed recently, pause and set state to `AWAITING_COOLDOWN`. Poll every 30 seconds. Resume when an agent becomes available.

**No smart selection in MVP.** Cost optimization, quality-based routing, and load balancing are post-MVP.

**Impact on:** `04-switching-rules.md`

---

## Decision 6 — When review happens

**Rule:** Review at task completion or by manual trigger only. Not after every switch.

**Rationale:** Reduces cost and noise. Keeps the MVP loop simple.

**Post-MVP:** Reviewer agent compares implementation against acceptance criteria and test coverage after each step or on demand.

**Impact on:** `03-agent-workflow.md` (completion step)

---

## Decision 7 — What requires user approval

**Requires approval:**
- Creating or approving the initial plan
- Meaningfully changing the plan mid-task
- Marking a task complete when confidence is low (test command unavailable or fails)
- Merging the task branch into `main`
- Deleting or closing a task branch

**Does not require approval (fully autonomous):**
- Agent switching
- File edits on the task branch
- Test runs
- Intermediate commits on the task branch
- Handoff creation

**Impact on:** `01-product-requirements.md`, `03-agent-workflow.md`

---

## Decision 8 — Agent git autonomy

**Agents may:**
- Edit files in the workspace
- Run tests
- Stage changes (`git add`)
- Create commits on the task branch with the required format
- Add handoff notes

**Agents may not:**
- Commit to `main`
- Merge into `main`
- Force push (`--force`)
- Delete branches
- Rewrite history (`rebase`, `reset --hard`, `amend` on pushed commits)

**Commit message format:**
```
agent(codex): <description>
agent(claude): <description>
agent(review): <description>
```

**Merge to main:** Always requires user approval via the mobile UI (`POST /branch/merge`). Not implemented in MVP — user merges manually. The UI shows a "Ready to merge" status when all acceptance criteria pass.

**Impact on:** `01-product-requirements.md`, `03-agent-workflow.md`

---

---

## Decision 9 — Work hierarchy: Project → Sprint → Task

**Rule:** Dorch organises all work in three levels. A **project** is a persistent entity with its own folder, workspace repo, and memory store. A **sprint** is a focused block of work: a goal, a git branch, a Planner conversation, and a set of tasks. A **task** is one step within a sprint, worked by one agent run-until-blocked cycle.

**Sprint closes on merge.** When the user approves sprint close, Dorch writes the sprint summary, archives the Planner conversation, and marks the sprint as CLOSED. The branch is then merged to main.

**Impact on:** `12-project-sprint-model.md`, `06-file-structure.md`, `02-system-architecture.md`, `05-memory-and-context.md`, `08-mvp-build-order.md`

---

## Decision 10 — New project with no existing repo

**Rule:** When a project is created without a `repoUrl`, Dorch runs `git init` in `projects/<slug>/workspace/`, creates an initial commit, and pushes to a new upstream remote. The upstream URL is provided by the user at project creation (or pre-configured in `.env` as `DORCH_DEFAULT_REMOTE_TEMPLATE`).

**Rationale:** Sprint branches and merges require a proper git repo. Deferring git setup breaks everything downstream.

**Impact on:** `12-project-sprint-model.md`, `08-mvp-build-order.md`

---

## Decision 11 — Sprint context compression at close

**Rule:** When a sprint closes, Dorch compresses the sprint's Planner conversation and agent handoff history into a sprint summary (~500 tokens) written to `projects/<slug>/memory/sprints/sprint-N.md`. The raw conversation thread is archived to `projects/<slug>/planner/sprint-N-conversation.jsonl`. The next sprint's agent context contains only: project-brief + project-summary + last sprint summary + current task. Previous sprint summaries are not loaded unless explicitly recalled.

**Rationale:** Don't dump all history into the context window. Give agents surgical access to what they need — the important decisions survive in structured form, the noise is dropped.

**Impact on:** `12-project-sprint-model.md`, `05-memory-and-context.md`

---

## Decision 12 — Sprint recall via `/recall sprint-N`

**Rule:** Sprint history is always preserved on disk (`sprints/sprint-N.md` + archived conversation). By default only the previous sprint summary is loaded as context. When a new sprint is doing tandem work with an earlier sprint, the user types `/recall sprint-N` in the Planner chat to explicitly load that sprint's summary into the current working context.

**Behaviour:**
- Recall is additive — stacks on top of the normal baseline, does not replace it
- Default = summary only (~500 tokens per recalled sprint)
- Multi-sprint recall allowed: `/recall sprint-01 sprint-03`
- Recalled context persists for the duration of the sprint (included in every agent start until close)
- The full archived conversation log is always on disk but never auto-loaded — summary is sufficient in almost all cases

**Rationale:** Projects accumulate sprint history that agents can't access without exploding the context window. `/recall sprint-N` is a deliberate, user-controlled way to bring specific past decisions to the foreground only when needed. It costs tokens deliberately rather than wastefully.

**MVP scope:** `/recall sprint-N` by number is MVP — sprint summaries are already written at close, the command is just a Planner chat handler that reads them. The SQLite keyword/file search layer is post-MVP.

**Impact on:** `12-project-sprint-model.md`, `11-planner-chat.md`

---

## Decision 13 — Data split: MongoDB vs markdown files

**Rule:** Dorch uses two storage layers. MongoDB stores structured metadata that the application needs to query. Markdown files on disk store context that agents need to read.

**What goes in MongoDB:**
- Projects (slug, name, repoUrl, createdAt, archivedAt)
- Sprints (projectSlug, n, goal, status, branch, createdAt, closedAt)
- Sessions (express-session store via connect-mongo)
- Planner conversation turns (from, text, ts) — persisted to Mongo for query/paging; also written to `.jsonl` on disk for agent replay

**What stays as markdown files:**
- `project-brief.md` — agents read this
- `project-summary.md` — agents read this
- `current-sprint.md` — agents read this
- `current-task.md` — agents read this
- `latest-handoff.md` — agents read this
- `sprints/sprint-N.md` — agents and Planner read this
- `handoff-history.md` — debugging only
- `run-log.md` — crash recovery + UI log
- `review-notes.md` — user annotations

**The hard rule:** Agents cannot query MongoDB. They read files. Any context an agent needs must exist as a markdown file. The app layer (HTTP server, Planner, Switch Controller) may use MongoDB for its own bookkeeping, but must never bypass the memory module to serve context to agents.

**Auth:** Single password stored in `DORCH_SESSION_SECRET` env var. `express-session` + `connect-mongo` for session storage. All `/projects/*` routes require a valid session cookie. Auth endpoints: `POST /auth/login`, `POST /auth/logout`.

**Rationale:** MongoDB gives the UI fast structured queries without parsing markdown. Markdown files give agents simple, reliable, format-agnostic context. Mixing the two — e.g. serving a JSON dump to agents — would couple the storage format to the agent prompt format and make both harder to change.

**Impact on:** `02-system-architecture.md`, `05-memory-and-context.md`, `06-file-structure.md`, `08-mvp-build-order.md`

---

## Decision 14 — Planner uses claude-cli for plan generation

**Rule:** The Planner shells out to claude-cli to generate sprint plans and answer questions. It is not template-based and does not call the Anthropic API directly.

**How it works:**
- When a sprint is created, the Planner spawns a claude-cli process with a planning-specific system prompt and the following context: project-brief.md, project-summary.md, the repo's `package.json` (if present), a `git log --oneline -20` summary, and the user's sprint goal
- The Planner passes the conversation history (from `current-conversation.jsonl`) on each invocation so claude-cli has the full thread
- Claude-cli responds with clarifying questions or, once it has enough information, writes `current-sprint.md` and `current-task.md` directly in the workspace
- The Planner module captures claude-cli's output, writes each turn to `current-conversation.jsonl`, and returns the response text to the HTTP layer

**This is distinct from coding agent runs:**
- Coding agents run via `executor/index.js` using `agents/claude.adapter.js` — long-running sessions, full workspace access, commit rights
- The Planner spawns claude-cli in a short-lived, read-mostly session — it inspects the repo and writes plan files only, no code edits
- The Planner does not go through the Switch Controller or Monitor — it is invoked directly by HTTP route handlers

**Option A (template questions) is dropped.** claude-cli handles question generation from sprint start.

**Impact on:** `11-planner-chat.md`, `02-system-architecture.md`

---

## Config Values Added by These Decisions

```
DORCH_MAX_SWITCHES_PER_TASK      config.maxSwitchesPerTask          default: 6
DORCH_MAX_CONSECUTIVE_FAILURES   config.maxConsecutiveFailures      default: 3
DORCH_RATE_LIMIT_COOLDOWN_MS     config.rateLimitCooldownMs         default: 90000
DORCH_NO_OUTPUT_TIMEOUT_MS       config.noOutputTimeoutMs           default: 180000   (3 min)
DORCH_MAX_RUNTIME_MS             config.maxRuntimeMs                default: 2700000  (45 min)
DORCH_TEST_COMMAND               config.testCommand                 default: 'npm test'
DORCH_SPRINT_BRANCH_PREFIX       config.sprintBranchPrefix          default: 'agent/sprint-'
DORCH_DEFAULT_REMOTE_TEMPLATE    config.defaultRemoteTemplate       default: ''
DORCH_MONGO_URI                  config.mongoUri                    default: 'mongodb://localhost:27017/dorch'
DORCH_SESSION_SECRET             config.sessionSecret               default: (required — no fallback)
DORCH_SESSION_MAX_AGE_MS         config.sessionMaxAgeMs             default: 604800000  (7 days)
```
