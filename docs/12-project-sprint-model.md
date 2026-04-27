# 12 — Project and Sprint Model

## Overview

Dorch organises work in three levels: **Project → Sprint → Task**. This maps cleanly onto git branches, context windows, and how humans actually think about software work.

```
Project                    persistent entity, own folder + repo
  └── Sprint               branch + conversation + set of tasks
        └── Task           one agent step, one run-until-blocked cycle
```

---

## Projects

A project is a persistent workspace. It has its own folder on the VPS, its own git repo (or a clone of a remote), its own plan, and its own memory store.

**Creating a project:**
1. User names the project and optionally provides a repo URL
2. Dorch creates `projects/<project-slug>/`
3. Workspace setup (one of two paths):
   - **Existing repo** (`repoUrl` provided): clone into `workspace/`, set up remote tracking
   - **New project** (no `repoUrl`): `git init` in `workspace/`, create initial commit, push to a new upstream remote (URL provided by user or via `DORCH_DEFAULT_REMOTE_TEMPLATE`)
4. Initialises memory files under `projects/<project-slug>/memory/`
5. Mobile UI shows the project in the project list

**Project memory files:**
```
projects/<slug>/memory/
  project-brief.md          one-page description of what this project is
  project-summary.md        auto-updated: key decisions, architecture, current state
  sprints/
    sprint-01.md            sprint summary (written at merge, permanent)
    sprint-02.md
    ...
  current-sprint.md         symlink or copy of the active sprint summary
  run-log.md                append-only event log
```

**Project is never deleted in MVP** — only archived. Archiving stops agents from running but preserves all memory.

---

## Sprints

A sprint is the unit of focused work. It has:
- A goal (1–3 sentences)
- A set of tasks (the plan for this sprint)
- A dedicated git branch: `agent/sprint-<N>-<slug>`
- A Planner conversation (the input surface)
- A sprint summary written at close

**Sprint lifecycle:**
```
PLANNED → ACTIVE → REVIEW → CLOSED
```

- `PLANNED` — sprint created, goal defined, tasks not yet started
- `ACTIVE` — agents are running tasks, branch is live
- `REVIEW` — all tasks complete, awaiting user review and merge approval
- `CLOSED` — branch merged to main, sprint summary written, conversation archived

**Sprint branch strategy:**
```
main
  └── agent/sprint-01-auth-refactor
  └── agent/sprint-02-rate-limiting
```

One active sprint branch at a time in MVP. A sprint is only merged after the user explicitly approves via the mobile UI.

**Sprint summary (written at close):**
```markdown
# Sprint 01 — auth-refactor

Closed: 2026-04-26
Branch: agent/sprint-01-auth-refactor
Merged: yes

## Goal
Refactor the auth module into separate files with full test coverage.

## What was built
- auth/validators.js — JWT and scope validation (87 lines)
- auth/session.js — session middleware extracted from index.js
- auth/index.js — updated to re-export from new files

## Key decisions
- Used throw (not return null) for invalid token errors — matches existing error handler pattern
- Did not modify legacy.js — left as-is per constraints

## Test results
14 tests passing, 0 failing. Coverage: 84%.

## Agent switches
3 switches: 1× rate_limit (codex), 1× manual, 1× rate_limit (claude)

## What the next sprint should know
- legacy.js is excluded from all changes — do not touch
- The error handler in middleware/errors.js expects Error objects, not strings
- npm test runs jest with --coverage flag
```

---

## Tasks

Tasks are unchanged from the existing spec — they are the individual steps within a sprint's plan. Each task has acceptance criteria and is worked by one agent run at a time.

The term "task" replaces what was previously called "step" in user-facing language. Internally, the plan still uses step numbering.

---

## Context Assembly Per Level

The auto-memory principle applies here: **don't dump all history into the context window**. Give agents surgical access to what they need.

```
At sprint start, agent receives:
  project-brief.md          ~200 tokens  — what this project is
  project-summary.md        ~300 tokens  — current architecture + key decisions
  current sprint goal        ~100 tokens  — what this sprint is for
  current-task.md            ~200 tokens  — the specific task
  latest-handoff.md          ~400 tokens  — last switch within this sprint

Total: ~1200 tokens baseline context
```

Previous sprints are **not** loaded into context automatically. The agent can reference them if needed via a future recall command, but they don't consume context by default.

**Context compression at sprint close:**
When a sprint closes, Dorch compresses the sprint's conversation and handoff history into the sprint summary (~500 tokens). The raw conversation thread is archived. The next sprint starts fresh with the summary, not the full thread.

This is the "context compaction that doesn't lobotomise the agent" — the important stuff survives in structured form; the noise is dropped.

---

## The Planner Conversation

Each sprint has exactly one Planner conversation. It is the persistent input surface for that sprint — not just a one-shot question session.

**What you can do in the Planner conversation:**
- Define the sprint goal
- Answer clarifying questions
- Review and edit the plan before approving
- Check in during execution ("how is the auth refactor going?")
- Redirect mid-sprint ("actually, skip the session middleware for now")
- Review at close ("looks good, merge it")

**Context in the Planner conversation:**
The Planner always has access to:
- project-brief.md + project-summary.md
- The current sprint plan and status
- Latest handoff (so it can answer "how is it going?")

It does NOT have full agent stdout/stderr in its context — that lives in the Logs screen. The Planner sees structured summaries, not raw output.

**Conversation length:**
When a Planner conversation approaches its context limit (e.g. 70% full), Dorch automatically compresses older turns into a summary and appends it as a system message at the top of the thread. The user never loses continuity. This is the in-sprint version of auto-memory.

---

## Sprint Recall

By default each sprint only loads the previous sprint summary as context. But when a new sprint is doing tandem work with an earlier sprint — touching the same files, continuing interrupted work, reversing a decision — the user can explicitly recall that sprint's context.

**`/recall sprint-01`** — typed in the Planner chat. Loads `sprints/sprint-01.md` into the current sprint's active context as an injected block. Planner confirms: `sprint-01 context loaded (+480 tokens)`.

**Rules:**
- Default recall = summary only (~500 tokens). The full archived conversation is on disk but not loaded unless needed.
- Multi-recall is allowed: `/recall sprint-01 sprint-03` loads both.
- Recall is additive — it stacks on top of the normal baseline, not replacing it.
- Recalled context stays for the duration of the sprint. It is included in the next agent start until the sprint closes.

**Token budget with recall:**
```
Normal baseline:          ~1200 tokens
+ /recall sprint-01:      + ~500 tokens
+ /recall sprint-03:      + ~500 tokens
                          ──────────────
Total:                    ~2200 tokens  (still well under 32k cap)
```

**Why this matters:** Sprint history is always preserved on disk. `/recall` is not a search — it's a deliberate "bring this sprint's full decisions to the foreground." When something goes wrong 5 sprints in, `/recall sprint-02` surfaces exactly what was decided and why.

The SQLite indexed recall layer (for querying by file or keyword across all sprints) is post-MVP. `/recall sprint-N` by number is MVP — sprint summaries are already written, it's just a Planner chat command that reads them.

**Post-MVP recall layer:** `memory.db` SQLite per project. Stores sprint summaries indexed by file touched and key decision keywords. Agents can query it surgically:
```
RECALL: auth/validators.js
→ returns: sprint-01 (created), sprint-03 (modified — added scope validation)
```

---

## Data Structure on Disk

```
dorch/
  projects/
    <project-slug>/
      workspace/             git clone of the project repo
      memory/
        project-brief.md
        project-summary.md
        current-sprint.md    copy of active sprint's goal + status
        sprints/
          sprint-01.md       permanent sprint summaries
          sprint-02.md
          ...
        run-log.md
        review-notes.md
      planner/
        sprint-01-conversation.jsonl   archived conversation turns
        sprint-02-conversation.jsonl
        current-conversation.jsonl     active sprint's live conversation
      memory.db              SQLite recall index (post-MVP)
```

---

## HTTP API Changes

```
POST /projects/create           body: { name, repoUrl? }
GET  /projects                  returns: list of projects
GET  /projects/:slug            returns: project detail + sprint list

POST /projects/:slug/sprints/create    body: { goal }
GET  /projects/:slug/sprints/:n        returns: sprint detail
POST /projects/:slug/sprints/:n/close  body: {}  → writes sprint summary, sets status REVIEW
POST /projects/:slug/sprints/:n/merge  body: {}  → merges sprint branch into main, sets status CLOSED

POST /projects/:slug/planner/message   body: { text } — send message to Planner
GET  /projects/:slug/planner/messages  returns: current conversation thread

GET  /projects/:slug/status     returns: active sprint, current task, agent state
GET  /projects/:slug/logs/stream SSE log stream for this project
```

---

## Mobile UI Changes

The mobile UI gains a **project picker** as the root screen. Tapping a project opens its dashboard.

Within a project, navigation is the same as current (Dashboard, Logs, Plan, Handoff) but a new **Chat** tab replaces the start-task flow. The Chat tab is the Planner conversation — persistent, always accessible, the primary way to communicate with Dorch about this project.

New screens:
- **Projects** — list of projects, create new
- **Sprint** — sprint goal, status, close/merge action
- **Chat** — Planner conversation (replaces one-shot plan chat)

Updated screens:
- **Plan** — now shows sprint tasks, not a one-time task list
- **Dashboard** — shows project name + sprint name in header

---

## Migration from Task Model

The existing docs describe a single-task, single-workspace model. Under the new model:

| Old concept | New concept |
|------------|-------------|
| Task string | Sprint goal |
| Task steps | Sprint tasks |
| Single workspace | `projects/<slug>/workspace/` |
| Single memory dir | `projects/<slug>/memory/` |
| One task branch | One sprint branch per sprint |
| `current-task.md` | Sprint tasks + `current-sprint.md` |

The task/step execution model (agents, monitor, switch controller, handoffs) is unchanged. The new model wraps it in a project + sprint container.

---

## MVP Scope for This Feature

**Include in MVP:**
- Project creation (name + optional repo URL)
- Multiple projects (list + picker UI)
- Sprint creation with goal
- Sprint close + summary write + merge approval
- Planner conversation per sprint (persistent, not one-shot)
- Context compression at sprint close
- `/recall sprint-N` command in Planner chat

**Post-MVP:**
- SQLite recall layer (keyword/file search across all sprints)
- Automatic project-summary.md updates after each sprint
- Sprint templates (e.g. "feature sprint", "bug fix sprint", "refactor sprint")
- Sprint branching from any base branch (not just main)
