# 08 — MVP Build Order

## Guiding Principle

Build one thing. Verify it works. Build the next thing. Never build two unproven layers at once. The build order below is a strict dependency chain — each phase depends only on what came before it. Do not skip ahead.

If a phase cannot be verified, stop and fix it before proceeding. Do not paper over a broken phase with the next one.

---

## Strict Build Sequence

### Step 1 — CLI wrapper for Codex (codex.adapter.js)
- Spawn codex-cli as a child process
- Inject a hardcoded test prompt
- Return stdout and stderr streams
- Verify: run the wrapper standalone, see output in terminal, confirm process exits cleanly

**Do not touch Dorch or monitor yet.**

---

### Step 2 — CLI wrapper for Claude (claude.adapter.js)
- Same as Step 1 but for claude-cli
- Verify: same standalone test

**Do not proceed until both adapters work in isolation.**

---

### Step 3 — Database and auth foundation
- Implement `db/index.js`: connect to MongoDB via Mongoose using `DORCH_MONGO_URI`
- Define models: Project (slug, name, repoUrl, createdAt, archivedAt), Sprint (projectSlug, n, goal, status, branch, createdAt, closedAt)
- Wire `express-session` + `connect-mongo` in `server/index.js`
- Implement `POST /auth/login` (compares password to `DORCH_SESSION_PASSWORD`) and `POST /auth/logout`
- Add session guard middleware: all `/projects/*` routes return 401 if no valid session
- Verify: POST /auth/login with correct password sets cookie; subsequent /projects request returns 200; wrong password returns 401; POST /auth/logout clears cookie

**No file system work yet — just Mongo + auth.**

---

### Step 4 — Project creation and memory initialization
- Implement `memory/index.js` with `initProject(slug)` and all read/write functions
- Implement `POST /projects/create`: creates a Project document in Mongo, creates `projects/<slug>/workspace/` and `projects/<slug>/memory/`, clones or `git init`s the workspace, calls `initProject(slug)` to write placeholder memory files
- Implement `GET /projects` and `GET /projects/:slug` returning Mongo data
- Verify: POST /projects/create with a name, inspect Mongo document + folder tree on disk — all memory files present, workspace is a valid git repo

**No agent runs yet.**

---

### Step 5 — Sprint creation
- Implement `lib/git.js` with `createBranch(slug, branchName)` and `mergeBranch(slug, branch, into)`
- The `POST /projects/:slug/sprints/create` route handler does three things in order:
  1. Creates a Sprint document in Mongo
  2. Calls `memory.writeCurrentSprint(slug, ...)` to write `current-sprint.md`
  3. Calls `git.createBranch(slug, 'agent/sprint-01-<slug>')` to create the branch in the workspace
- Verify: Sprint document in Mongo, `current-sprint.md` written, branch exists in workspace repo (`git branch` confirms it)

**No agent runs yet.**

---

### Step 6 — Run a single agent task end-to-end (no switching)
- Wire config, dorch-bus.js, and orchestrator entry point
- Assemble context via `memory.assembleContext(slug)` from the project memory files
- Start one agent (codex-cli) with real context
- Pipe output to console
- Let it run to natural exit
- Verify: agent receives context, works on a real file in the workspace, exits

**No monitor, no handoff, no switching yet.**

---

### Step 7 — Add the monitor (detect exit and rate limits)
- Attach monitor to agent streams
- Detect process exit (clean and error)
- Detect rate-limit strings using the exact patterns in `04-switching-rules.md`
- Detect no-output timeout (3 min / 180000ms) and max-runtime timeout (45 min / 2700000ms)
- Emit trigger events on the bus
- Verify: pipe a fake stream that emits "rate limit exceeded" — confirm trigger fires. Simulate no output for timeout duration — confirm timeout trigger fires.

**No switching action yet — just confirm events fire correctly.**

---

### Step 8 — Add handoff file writing
- Implement handoff-manager.js
- On any trigger event, write `latest-handoff.md` using the strict format from `05-memory-and-context.md`
- Append to `handoff-history.md`
- Verify: trigger an event manually, inspect the written file — confirm all seven sections present with correct field names

**No agent switching yet.**

---

### Step 9 — Add switching logic (switch-controller)
- Implement state machine: IDLE → RUNNING → SWITCHING → RUNNING
- On trigger: stop current agent → write handoff → start next agent
- Round-robin between configured agents
- Apply hard limits: max 6 switches, max 3 consecutive failures
- Verify: run a real task, manually trigger a switch via `POST /projects/:slug/agent/switch`, confirm old agent stops, handoff is written, new agent starts with handoff context

---

### Step 10 — Add the mobile UI and HTTP server
- Complete all REST endpoints (projects, sprints, planner, agent, status, logs)
- Add SSE log stream at `/projects/:slug/logs/stream`
- Build and serve the Vite + React PWA frontend
- Verify: open on phone, create a project + sprint via Chat UI, watch live logs, trigger a manual switch

---

### Step 11 — Add crash recovery
- On startup, read run-log.md for each project and determine whether to resume
- Verify: kill Dorch mid-run, restart it, confirm it picks up from the handoff

---

### Step 12 — Deployment
- .env file, PM2 config, README, Let's Encrypt HTTPS

---

## Build Checklist (in order)

```
[ ] Step 1   agents/codex.adapter.js — standalone test passes
[ ] Step 2   agents/claude.adapter.js — standalone test passes
[ ] Step 3   db/index.js + models, express-session + connect-mongo, auth endpoints
             → login sets cookie; /projects returns 401 without cookie
[ ] Step 4   memory/index.js (initProject + all read/write fns)
             POST /projects/create — Mongo doc + folder tree + git init or clone + memory files
             → inspect Mongo + disk: all files present, workspace is valid git repo
[ ] Step 5   Sprint creation — Sprint Mongo doc + current-sprint.md + branch created
             → sprint state correct in Mongo and memory files, branch exists in workspace
[ ] Step 6   config.js, dorch-bus.js, dorch.js skeleton
             → single agent runs with real context from project memory, output visible
[ ] Step 7   monitor/triggers.js, monitor/monitor.js
             → rate-limit trigger fires on fake stream
             → no-output timeout fires after mock delay
[ ] Step 8   handoff/handoff-manager.js
             → latest-handoff.md written with all 7 sections present
[ ] Step 9   switch-controller/index.js, executor/index.js
             → manual switch: old agent stops, handoff written, new agent starts
[ ] Step 10  server/index.js (all endpoints), Vite + React PWA frontend
             → create project + sprint on phone, see live logs, trigger switch
[ ] Step 11  Crash recovery in dorch.js
[ ] Step 12  .env, PM2, README, HTTPS
```

---

## Definition of MVP Complete

- [ ] User can create a project via mobile UI (with or without an existing repo URL)
- [ ] Creating a project initialises the folder, workspace repo, and all memory files
- [ ] User can start a sprint with a goal via the Chat UI
- [ ] Dorch creates a sprint branch and starts the first task with an agent
- [ ] If agent hits a rate limit, switch happens automatically within 60 seconds
- [ ] New agent starts from handoff file with no manual intervention
- [ ] User can see live log output on phone
- [ ] User can trigger a manual switch from phone
- [ ] User can close a sprint (writes sprint summary, merge approval)
- [ ] Dorch survives a process restart and resumes from last known state
- [ ] Both codex-cli and claude-cli adapters work
