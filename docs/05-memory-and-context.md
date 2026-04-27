# 05 — Memory and Context

## Overview

Dorch uses two storage layers — and it is critical to keep them separate.

**Markdown files** (`projects/<slug>/memory/`) are the source of truth for agent context. Agents read these files directly. Dorch must be restartable at any time and able to resume from them alone. The memory module (`memory/index.js`) is the only code that may touch these files.

**MongoDB** stores structured metadata: projects, sprints, sessions, and planner conversation turns. The app layer (HTTP server, Planner, Switch Controller) uses Mongo for queries and bookkeeping. Agents never touch Mongo — any context they need must exist as a markdown file.

**Never write agent context only to Mongo.** If it needs to reach an agent, it lives on disk.

---

## File Index

| File | Written By | Read By | Truncated? |
|------|-----------|---------|-----------|
| `project-brief.md` | User (via UI) / Planner | Executor, Planner | Overwritten on edit |
| `project-summary.md` | Planner (on sprint close) | Executor, Planner | Overwritten after each sprint |
| `current-sprint.md` | Switch Controller | Executor, UI | Overwritten on sprint change |
| `sprints/sprint-N.md` | Planner (on sprint close) | UI, next sprint context | New file per sprint |
| `current-task.md` | Planner, Switch Controller | Executor, UI | Overwritten when task changes |
| `latest-handoff.md` | Handoff Manager | Executor, UI | Overwritten on each switch |
| `handoff-history.md` | Handoff Manager | UI, debugging | Append-only |
| `run-log.md` | Dorch | UI, crash recovery | Append-only |
| `review-notes.md` | User (via UI) | Planner | Overwritten on each edit |

---

## project-brief.md

**Purpose:** One-page description of what this project is. Written by the user (via Planner chat) when the project is created. Every agent start reads this file. It should be stable — not updated frequently.

**Format:**

```markdown
# Project: <name>

## What this is
<1–3 sentences: what the project does and who it's for>

## Tech stack
- <language, framework, key dependencies>
- Entry point: <main file>
- Test command: <how to run tests>

## Constraints
- <things agents must never do — e.g. "do not modify auth/legacy.js">
- <key architecture rules>
```

**Who updates it:** The Planner writes the initial version during project creation. The user can update it via the Chat UI at any time.

---

## project-summary.md

**Purpose:** Auto-updated snapshot of the project's current architecture and key decisions. Rewritten by the Planner at the close of each sprint. Agents read this to understand what has been built so far without loading full sprint history.

**Format:**

```markdown
# Project Summary

Last updated: sprint-<N>

## Current architecture
<3–5 bullet points describing the module structure and main patterns>

## Key decisions
- <decision 1 — one line>
- <decision 2 — one line>

## What's been built
- <feature/module>: <one-line status>
```

**Who updates it:** Planner only, on sprint close. Never manually edited.

---

## current-sprint.md

**Purpose:** The active sprint's goal, status, and task list. Agents read this to know what the current sprint is trying to achieve.

**Format:**

```markdown
# Sprint <N> — <slug>

Goal: <1–3 sentences>
Status: ACTIVE
Branch: agent/sprint-<N>-<slug>

## Tasks
- [ ] 1. <task description>
  - Acceptance: <how to verify>
- [x] 2. <task description>
  - Acceptance: <how to verify>
- [ ] 3. <task description>  ← CURRENT
  - Acceptance: <how to verify>
```

**Who updates it:** Switch Controller updates checkboxes and the `← CURRENT` marker. Planner writes the initial version when a sprint is created.

---

## sprints/sprint-N.md

**Purpose:** Permanent summary written when a sprint closes. Used by the Planner at the start of the next sprint as compressed context. See `12-project-sprint-model.md` for the exact format.

**Who updates it:** Planner only, on sprint close. Never modified after writing.

---

## current-task.md

**Purpose:** Focused context for the active task only. Shorter than the sprint plan — designed to be injected directly into the agent's prompt without overwhelming it.

**Format:**

```markdown
# Current Step

**Step:** <number> of <total>
**Description:** <step description from global plan>
**Acceptance criteria:** <how to verify this step is complete>

## What to do

<1–3 sentences of specific instruction for this step>

## What not to do

<any specific things to avoid — e.g. "don't refactor unrelated files">

## Related files

<list of files likely relevant to this step, inferred from repo structure>
```

**Who updates it:** The Switch Controller rewrites this file when advancing to a new step. The Planner writes the initial version for step 1.

---

## latest-handoff.md

**Purpose:** The most recent handoff summary. This is the primary mechanism for context continuity between agents. Every agent start reads this file.

**Strict format — no deviations.** The Handoff Manager must produce this exact structure. Agents must be able to parse it reliably without guessing at headings or field names.

Target length: 500–800 tokens. No paragraphs. No extra headings.

```markdown
## Handoff
Agent: <codex|claude>
Reason: <rate_limit|timeout|error|manual|complete>
Task: <exact step description from current-task.md>
Date: <ISO 8601 timestamp>

### Completed
- <one bullet per completed item; "none" if nothing finished>

### In Progress
- <partial work with file and function name where known; "none" if nothing started>

### Files Changed
- <relative/file/path>: <one-line summary of change>

### Issues / Blockers
- <known issue, uncertainty, or broken state; "none" if clean>

### Last Output
<last 10 lines of stdout/stderr verbatim — no paraphrasing>

### Next Step
<one sentence: the single most important action for the next agent to take first>
```

**Validation rules the Handoff Manager must enforce:**
- All seven sections must be present, in this order
- No section may be omitted, even if empty (use `- none`)
- `Agent:` must be exactly `codex` or `claude` — no version strings, no full paths
- `Reason:` must be one of the five exact values listed above
- `### Last Output` must be verbatim — do not summarise or truncate to fewer than 5 lines unless the agent produced fewer than 5 lines total
- `### Next Step` must be a single sentence — not a list, not a paragraph

**On first run:** The file exists but contains only:
```markdown
# Handoff
No prior handoff. This is the first agent run for this task.
```

**Who updates it:** Handoff Manager only. No other module writes this file.

---

## handoff-history.md

**Purpose:** Append-only log of all handoffs. Used for debugging and auditing. Not read by agents.

**Format:** Each entry is a full `latest-handoff.md` snapshot prepended with a separator:

```markdown
---
<!-- handoff #N — <timestamp> -->
<full handoff content>
```

Entries are prepended (newest at top) or appended (newest at bottom). Append is simpler — use append in MVP.

---

## run-log.md

**Purpose:** Timestamped event log. Used for crash recovery (see `03-agent-workflow.md` Step 7) and for displaying event history in the UI.

**Format:** One line per event:

```
[2026-04-26T09:14:01Z] [task:started] refactor auth module
[2026-04-26T09:14:03Z] [agent:started] codex-cli
[2026-04-26T09:28:44Z] [trigger:received] rate_limit
[2026-04-26T09:28:46Z] [agent:stopped] codex-cli (signal: SIGTERM)
[2026-04-26T09:28:47Z] [handoff:written] switch #1
[2026-04-26T09:28:48Z] [agent:started] claude-cli
[2026-04-26T09:44:12Z] [task:complete]
```

**Crash recovery:** On startup, Dorch reads `run-log.md` from the bottom and finds the last `[agent:started]` or `[task:complete]` entry to determine whether to resume or stay idle.

**Who writes it:** Only the Dorch (`dorch.js`) writes to this file. Other modules emit bus events; Dorch listens and appends.

---

## review-notes.md

**Purpose:** User annotations. The user can add notes, corrections, or revised instructions via the mobile UI. The Planner reads this file before writing or updating the global plan.

**Format:** Free-form markdown. No required structure.

**Who writes it:** The HTTP server writes whatever the user submits via the UI. The user can also edit it directly on the VPS.

---

## Memory Layer Module API

All memory file access must go through `memory/index.js`. Do not use `fs` directly in other modules.

All functions accept `slug` as the first argument. Paths resolve to `projects/<slug>/memory/`.

```
initProject(slug)                 → void   // creates folder tree + placeholder files if missing
readProjectBrief(slug)            → string
writeProjectBrief(slug, str)      → void
readProjectSummary(slug)          → string
writeProjectSummary(slug, str)    → void
readCurrentSprint(slug)           → string
writeCurrentSprint(slug, str)     → void
readSprintSummary(slug, n)        → string
writeSprintSummary(slug, n, str)  → void
readCurrentTask(slug)             → string
writeCurrentTask(slug, str)       → void
readLatestHandoff(slug)           → string
writeLatestHandoff(slug, str)     → void
appendHandoffHistory(slug, str)   → void
appendRunLog(slug, event, msg)    → void   // event is e.g. 'agent:started', msg is optional
readRunLog(slug)                  → string
readReviewNotes(slug)             → string
writeReviewNotes(slug, str)       → void
```

All writes use `fs.writeFileSync` or `fs.appendFileSync`. Do not use async file writes for memory files in MVP — the simplicity of synchronous writes eliminates partial-write race conditions.

---

## Context Assembly

Before each agent start, the Executor calls `memory.assembleContext(slug)` which returns:

```js
{
  projectBrief: string,     // full contents of project-brief.md
  projectSummary: string,   // full contents of project-summary.md
  currentSprint: string,    // full contents of current-sprint.md
  currentTask: string,      // full contents of current-task.md
  latestHandoff: string,    // trimmed — see size rules below
  isFirstRun: boolean       // true if latest-handoff.md contains "No prior handoff"
}
```

The Executor adds `slug` to this object before passing it to the adapter:

```js
const context = { slug, ...memory.assembleContext(slug) }
adapter.start(context)
```

The adapter uses `context.slug` to construct the workspace `cwd` and any temp file paths.

## Context Size Rules

Context bloat hits token limits fast — especially on Claude. These rules are mandatory and must be enforced in `memory.assembleContext()` before returning the object.

| Field | Rule |
|-------|------|
| `projectBrief` | Always pass in full |
| `projectSummary` | Always pass in full |
| `currentSprint` | Always pass in full |
| `currentTask` | Always pass in full |
| `latestHandoff` | Pass `latest-handoff.md` only — never pass `handoff-history.md` to agents |

**Handoff trimming:** If `latestHandoff` exceeds 4800 characters (~1200 tokens), trim by removing lines from the top of the file. Always preserve the following sections intact (never truncate them):
- `### Next Step`
- `### Last Output`
- The metadata block (`Agent:`, `Reason:`, `Task:`, `Date:`)

**Total context size cap:** The combined formatted string passed to the CLI must not exceed 32000 characters (~8000 tokens). If it does:
1. Trim `globalPlan` to the current step plus two surrounding steps only (not the full plan)
2. Log a warning to `run-log.md`: `[warn:context_trimmed] combined context exceeded 32000 chars`

These limits are conservative. Adjust `config.maxContextChars` if the agents in use support larger windows.

---

## File Initialization

`initProject(slug)` creates the project folder tree and placeholder files if they don't exist. Call it when a project is first created and on every Dorch startup (safe to call repeatedly — it is a no-op for files that already exist).

```
projects/<slug>/
  workspace/                   created empty; git init or clone happens separately
  memory/
    project-brief.md           → "# Project\nNo brief defined yet."
    project-summary.md         → "# Project Summary\nNo sprints completed yet."
    current-sprint.md          → "# Sprint\nNo active sprint."
    sprints/                   → created as empty directory
    current-task.md            → "# Current Task\nNo task active."
    latest-handoff.md          → "# Handoff\nNo prior handoff. This is the first agent run."
    handoff-history.md         → "" (empty)
    run-log.md                 → "" (empty)
    review-notes.md            → "" (empty)
  planner/
    current-conversation.jsonl → "" (empty)
```

The `memory/index.js` module exposes `initProject(slug)` for this purpose. `dorch.js` calls it on startup for every project folder found under `projects/`.
