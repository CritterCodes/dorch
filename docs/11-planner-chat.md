# 11 — Chat-Based Planner

## Overview

The Planner is a persistent conversation interface, one per sprint. It is the primary way the user communicates with Dorch about a project. The conversation starts when a sprint is created, runs through planning and implementation, and is archived (compressed into the sprint summary) when the sprint closes.

This is not a one-shot planning session. The user can message the Planner at any time during a sprint — to define the goal, answer questions, redirect work mid-sprint, check status, or approve close.

---

## Why Persistent Chat

A single task string rarely contains enough information to write good acceptance criteria. But more importantly, the Planner needs to be reachable during implementation — not just at the start.

**What users do in the Planner chat:**
- Define the sprint goal and answer clarifying questions
- Review and edit the task plan before approving
- Check in mid-sprint ("how is the auth refactor going?")
- Redirect the sprint ("actually, skip the session middleware for now")
- Approve sprint close ("looks good, merge it")

**Context the Planner always has:**
- `project-brief.md` + `project-summary.md`
- Current sprint plan and task status
- Latest handoff (so it can answer "how is it going?" accurately)

The Planner does NOT have raw agent stdout/stderr — that lives in the Logs screen. It sees structured summaries only.

---

## Sprint Lifecycle in Chat

```
Sprint created → Planner opens conversation

[Planning phase]
User:    "Refactor the auth module"
Planner: "Got it — sprint 01. A few questions:
          1. Stack confirmed Node/Express?
          2. Done = tests pass, or specific behaviour?
          3. Files I must not touch?"
User:    "Yes Node. Tests pass. Don't touch auth/legacy.js."
Planner: "Split into separate files (validators, middleware, session)
          or keep consolidated?"
User:    "Separate files."
Planner: → writes current-sprint.md + current-task.md
         → presents 7-task plan for approval

[Implementation phase — agents running]
User:    "How is it going?"
Planner: → reads latest-handoff.md
         → "Claude is on task 3/7 — extracted validators.js, fixing lint."

User:    "Skip the session middleware task"
Planner: → updates current-sprint.md, marks task 4 as skipped
         → notifies Switch Controller

[Sprint close]
User:    "Looks good, merge it"
Planner: → presents sprint summary for review
         → on confirm: writes sprints/sprint-01.md, archives conversation,
           updates project-summary.md, triggers merge approval
```

**Planning question limit:** 3 question turns max. After 3 turns (or earlier if the Planner has enough), it writes the plan and presents it. The user can always edit directly before approving.

---

## Planner Module Interface

The Planner module is sprint-scoped. It must export:

```
startSprint(slug, goal) → { firstMessage: string }
  // Creates sprint, writes current-sprint.md placeholder, returns opening question

reply(slug, userMessage) → { message: string, planReady: boolean }
  // Accepts user reply, returns next question or signals plan is ready

approvePlan(slug) → void
  // Finalises current-sprint.md and current-task.md, starts first agent

updateSprint(slug, directive) → void
  // Shells out to claude-cli with the directive + current-sprint.md content.
  // claude-cli rewrites current-sprint.md (e.g. marks a task skipped).
  // Planner verifies the write via memory.readCurrentSprint(slug).
  // Emits sprint:updated on dorch-bus — Switch Controller re-reads current-sprint.md
  // on next agent start. Does not interrupt the currently running agent.

closeSprint(slug) → { summary: string }
  // Writes sprints/sprint-N.md, updates project-summary.md, archives conversation
  // Returns the summary text for user review before merge is confirmed
```

Conversation state is stored in `projects/<slug>/planner/current-conversation.jsonl`. No in-memory session state — Dorch can restart and resume the conversation from disk.

---

## Plan Generation

The Planner shells out to claude-cli for all question generation and plan writing. There are no template questions.

**On sprint start, the Planner spawns claude-cli with:**
- A planning-specific system prompt (generate a sprint plan, ask ≤3 clarifying questions, write plan files when ready)
- `project-brief.md` + `project-summary.md`
- `package.json` contents (if present in workspace)
- `git log --oneline -20` output from the workspace
- The user's sprint goal

**Working directory:** The Planner spawns claude-cli from the **dorch root** (not the project workspace). This means claude-cli writes plan files using full paths relative to the dorch root: `projects/<slug>/memory/current-sprint.md` and `projects/<slug>/memory/current-task.md`. The Planner system prompt includes the exact target paths with the slug substituted in.

**On each subsequent user message**, the Planner re-spawns claude-cli with the full `current-conversation.jsonl` thread prepended so claude-cli has full context.

**When claude-cli has enough information**, it writes `current-sprint.md` and `current-task.md` to the paths provided in the system prompt, then outputs `PLAN READY` to stdout. The Planner module detects `PLAN READY`, then calls `memory.readCurrentSprint(slug)` and `memory.readCurrentTask(slug)` to verify the files were written before setting `planReady: true` in its response.

**Memory write exception:** This is the only place in Dorch where a process other than `memory/index.js` writes memory files. claude-cli is an external process and cannot call Node.js functions. The Planner module verifies the writes via memory reads immediately after — if the files are missing or empty, it returns an error and does not set `planReady: true`.

**This invocation is distinct from coding agent runs.** The Planner spawns claude-cli as a short-lived session — inspect the repo and write plan files only, no code edits, no commits. It does not go through the Executor, Monitor, or Switch Controller.

---

## Sprint Close Compression

`closeSprint(slug)` compresses the sprint history into a permanent summary by shelling out to claude-cli with a compression prompt. It passes:
- The full `current-conversation.jsonl` thread (Planner conversation)
- The full `handoff-history.md` content (agent switch history)
- The sprint goal and branch name

claude-cli outputs the sprint summary to stdout following the format defined in `12-project-sprint-model.md`. The Planner module captures this output and calls `memory.writeSprintSummary(slug, n, summary)` to write `sprints/sprint-N.md`. It then calls `memory.writeProjectSummary(slug, updatedSummary)` with an updated project summary reflecting the sprint's key decisions.

This is a second documented exception to the memory write rule — claude-cli produces the content, but the Planner module writes it via `memory/index.js`. No files are written by the external process itself during sprint close.

---

## Mobile UI

The Chat tab is a persistent bottom-nav item within every project. It is always accessible — during planning, during execution, and during review.

**Screen: Chat**

```
┌─────────────────────────────┐
│ Chat    auth-project·spr01  │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐   │
│  │ dorch               │   │
│  │ Sprint 01 · Quick   │   │
│  │ Qs:                 │   │
│  │ 1. Stack: Node?     │   │
│  │ 2. Done = tests?    │   │
│  │ 3. Files to avoid?  │   │
│  └─────────────────────┘   │
│                             │
│           ┌──────────────┐  │
│           │ Yes Node.    │  │
│           │ Tests pass.  │  │
│           │ No legacy.js │  │
│           └──────────────┘  │
│                             │
│  ┌─────────────────────┐   │
│  │ dorch               │   │
│  │ ✓ Writing 7-task    │   │
│  │ sprint plan…        │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────────┐│
│  │ Type a message…         ││
│  └──────────────────── ➤  ││
│                             │
│  [ Skip — write plan now ] │
└─────────────────────────────┘
```

**Interaction rules:**
- Chat is always open — user can message at any point in the sprint lifecycle
- "Skip — write plan now" is visible during planning only; disappears once plan is approved
- After `planReady: true`, the plan is shown inline for review before agents start
- Mid-sprint messages trigger `updateSprint()` — the Planner reads the current handoff before responding

---

## Plan Approval Screen

After the chat, the plan is shown for approval before any agent runs.

```
┌─────────────────────────────┐
│ Review Plan            edit │
├─────────────────────────────┤
│ Task: Refactor auth module  │
│                             │
│ ○ 1. Audit existing         │
│      structure              │
│   Acceptance: list all      │
│   exported functions        │
│                             │
│ ○ 2. Define validator       │
│      interface              │
│   Acceptance: interface     │
│   file exists, no impl yet  │
│ ...                         │
├─────────────────────────────┤
│ Constraints:                │
│ · Do not modify legacy.js   │
│ · Use ESM imports           │
├─────────────────────────────┤
│  [ Edit ]  [ ✓ Approve ]   │
└─────────────────────────────┘
```

---

## HTTP Endpoints for Planner Chat

These are a subset of the project/sprint API defined in `02-system-architecture.md`. Planner-specific endpoints:

```
POST /projects/:slug/sprints/create
                            body: { goal }
                            returns: { sprintN, message: string }  — opens Planner, returns first message

POST /projects/:slug/planner/message
                            body: { text }
                            returns: { message: string, planReady: boolean }

GET  /projects/:slug/planner/messages
                            returns: current-conversation.jsonl as array of { from, text, ts }

POST /projects/:slug/sprints/:n/close
                            body: {}
                            returns: { summary: string }  — sprint summary text for user review
```

---

## Slash Commands

The Planner chat recognises slash commands typed by the user. These are the first-class commands for MVP:

| Command | What it does |
|---------|-------------|
| `/recall sprint-N` | Loads `sprints/sprint-N.md` into current context. Confirms: `sprint-01 context loaded (+480 tokens)`. |
| `/recall sprint-N sprint-M` | Loads multiple sprint summaries. Each adds ~500 tokens. |

Slash commands are detected by the Planner message handler before passing input to the conversation engine. If the input starts with `/`, it is treated as a command, not a chat message.

**Why `/recall` matters:** A project is a folder of sprints. Sprint history is always preserved. `/recall sprint-01` is how you bring earlier decisions to the foreground when a new sprint is doing tandem work — refreshing that context without loading the full conversation archive.

---

## Conversation Storage (dual-write)

Every message exchange writes to two places. The route handler for `POST /projects/:slug/planner/message` is responsible for both:

1. **`.jsonl` on disk** — `planner.reply()` appends each turn (user + planner) to `projects/<slug>/planner/current-conversation.jsonl`. This is what the Planner reads on the next invocation to reconstruct conversation history. It is the source of truth for the Planner.

2. **MongoDB** — after `planner.reply()` returns, the route handler saves both turns as `PlannerMessage` documents (projectSlug, sprintN, from, text, ts). This is what `GET /projects/:slug/planner/messages` queries to serve the chat UI. It is the source of truth for the UI.

The `.jsonl` file is never read by the UI. The MongoDB records are never read by the Planner. The two stores serve different consumers and never need to be kept in sync beyond the write moment.

---

## Implementation Notes

- Conversation state is written to `projects/<slug>/planner/current-conversation.jsonl` after every message — Dorch restarts cleanly without losing context
- The Planner reads the repo (`ls`, `git log`, `package.json`) before generating the first message so it can pre-answer stack questions
- When approaching context limit (~70% full), Dorch compresses older turns into a summary message prepended to the thread — the user never loses continuity
- Keep question messages short — this is a mobile UI, long text is hard to read
- In MVP, question generation uses template questions (Option A). Option B (LLM-generated questions) is post-MVP
