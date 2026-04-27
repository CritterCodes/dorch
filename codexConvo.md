I’ll first map the project without changing anything: file structure, likely entry points, dependencies, and what the current artifacts are trying to do. After that I’ll ask only for the GitHub-specific choices that can’t be inferred locally.


Ran 3 commands
This is not currently a Git repository, and the directory is a small product/design spec bundle rather than an implemented app repo. I’m going deeper into the specs and duplicated UI files now so the plan reflects the actual project shape instead of just “initialize git.”


Ran 8 commands
The docs are internally split between an earlier single-task MVP and a newer Project > Sprint > Task model. The newer decisions and CLAUDE.md clearly make Project/Sprint the intended direction, so I’m treating those as canonical and checking the remaining docs for contracts we should preserve.


Ran 12 commands
Worked for 51s
There are also generated/static prototype files with mojibake characters from encoding issues. The implementation plan should include preserving the markdown specs as source of truth while treating the HTML/JSX files as design references to replace with a real Vite UI later.

Ran if (Get-Command git -ErrorAction SilentlyContinue) { git --version; git config --get user.name; git config --get user.email; git config --get init.defaultBranch } else { Write-Output 'git not installed' } for 1s
Ran if (Get-Command gh -ErrorAction SilentlyContinue) { gh auth status } else { Write-Output 'gh not installed' } for 1s
Ran Get-ChildItem -Force | Where-Object { $_.Name -in @('package.json','.gitignore','.gitattributes') } | Format-Table -AutoSize
Ran Get-ChildItem -Recurse -Force -File | Sort-Object Length -Descending | Select-Object Length, FullName

Asked 3 questions
Plan


Open

Dorch Project Plan
Summary
Dorch is currently a spec/prototype bundle, not an implemented Node app. The canonical direction is the newer Project > Sprint > Task model from CLAUDE.md, docs/09-decisions.md, and docs/12-project-sprint-model.md.

Initial repo setup should happen first: initialize git on branch main, add ignore/metadata files, commit the current docs/prototypes, create a private GitHub repo at CritterCodes/dorch, and push main upstream.

Key Changes
Add repo hygiene before first commit:
.gitignore for node_modules/, .env, build output, runtime projects/, logs, caches, and OS/editor files.
.gitattributes to normalize text files as UTF-8/LF where practical.
Keep existing docs and prototypes as the first committed baseline.
Treat duplicated prototype files deliberately:
Keep Dorch Mobile UI.html, Spec.html, Spec-print.html, and both android-frame.jsx copies for the initial push.
Later replace prototypes with real server/ui/ Vite React app.
Preserve docs as implementation source of truth, with these canonical choices:
Multi-project model.
Sprint branches: agent/sprint-<NN>-<slug>.
MongoDB for app metadata and sessions.
Markdown files for agent-readable memory.
Express API, Vite React PWA frontend, Node 20 server code.
Codex and Claude CLI adapters as child processes.
Implementation Roadmap
Repository bootstrap

Run git init -b main.
Add .gitignore and .gitattributes.
Commit current directory as docs: initial dorch specification.
Create private GitHub repo CritterCodes/dorch using authenticated gh.
Add origin and push main.
Foundation

Add package.json, dorch.js, config.js, dorch-bus.js.
Implement required env validation for DORCH_SESSION_SECRET and DORCH_SESSION_PASSWORD.
Add Mongo/Mongoose models: Project, Sprint, PlannerMessage.
Add Express server with session auth.
Project and memory layer

Implement memory/index.js as the only app-owned writer for memory files.
Implement project creation: clone existing repo or create workspace with git init.
Implement lib/git.js as the only git command wrapper.
Create project list/detail endpoints.
Sprint and planner flow

Implement sprint creation with branch creation.
Implement Planner chat via claude-cli, backed by disk .jsonl plus Mongo UI records.
Implement plan approval before first agent run.
Agent execution loop

Build and verify agents/codex.adapter.js standalone.
Build and verify agents/claude.adapter.js standalone.
Add executor, monitor triggers, handoff manager, and switch controller in the documented order.
Verify manual switch, rate-limit switch, process error, timeout, and STEP COMPLETE test gate.
Mobile UI

Replace the static prototype with server/ui/ Vite React PWA.
Implement Projects, Chat, Status, Logs, Plan, Handoff, and Switch screens.
Serve built UI from Express and stream logs via SSE.
Recovery and deployment

Add crash recovery from run-log.md.
Add PM2 config and deployment docs.
Keep HTTPS and public exposure behind auth.
Test Plan
Repo setup: git status, git log --oneline, git remote -v, and GitHub repo visibility check.
Foundation: auth login/logout with cookies; /projects/* returns 401 without session.
Memory: project creation creates workspace, memory files, planner folder, and valid git repo.
Sprint: branch creation verified by git branch --show-current.
Adapters: standalone spawn/stop tests for Codex and Claude before orchestration.
Monitor: fake stream tests for rate limit, blocked, STEP COMPLETE, no-output timeout, and max runtime.
Handoff: validate required headings and required fields.
UI: phone-width smoke test for all screens plus SSE live logs.
Assumptions
GitHub owner is CritterCodes.
Repository name is dorch.
Repository visibility is private.
Default branch is main.
First push contains the current docs/prototype bundle only, plus repo hygiene files.
No implementation files are created before the initial upstream push.
Implement plan
8:58 PM


Worked for 7m 41s
Implemented and pushed to GitHub.

Repo: https://github.com/CritterCodes/dorch
Visibility: private
Branch: main

What landed:

Initialized git, added .gitignore / .gitattributes.
Baseline spec commit: 9d6c9f9 docs: initial dorch specification
Backend scaffold commit: 4471455 feat: scaffold dorch backend
Added Node 20 ESM app structure:
config/env validation
Express auth/session server
Mongo/Mongoose models
memory layer
git wrapper
planner wrapper
Codex/Claude adapters
monitor, handoff manager, executor, switch controller
focused tests
Verification:

npm install completed with 0 vulnerabilities.
npm test passes: 5/5 tests.
git status is clean and tracking origin/main.
Not fully implemented yet: the real Vite mobile UI, full crash recovery, deployment/PM2 config, and live verification of Codex/Claude CLI adapter flags against installed CLI versions.

28 files changed
+1142
-47
Undo

Review
.env.example
.gitattributes
.gitignore
agents/claude.adapter.js
agents/codex.adapter.js
agents/shared.js
config.js
db/index.js
db/models/planner-message.js
db/models/project.js
db/models/sprint.js
dorch-bus.js
dorch.js
executor/index.js
handoff/handoff-manager.js
lib/git.js
lib/paths.js
lib/slug.js
memory/index.js
monitor/monitor.js
monitor/triggers.js
package.json
planner/planner.js
server/index.js
switch-controller/index.js
test/config.test.js
test/memory.test.js
test/slug.test.js




9:05 PM
are we using MVC?

route > controller > service > model?

continue
9:09 PM


Worked for 2m 11s
Not originally. It was closer to “route handlers call services directly inside server/index.js.”

I refactored it to the pattern you asked for:

route -> controller -> service -> model

Current layout:

server/routes/ maps URLs to controllers
server/controllers/ handles HTTP request/response concerns
server/services/ owns business orchestration
db/models/ remains the Mongoose model layer
server/index.js now only wires middleware, routes, static serving, and errors
Pushed commit:
6cc2afa refactor: split http layer into mvc modules

Verification:

npm test passes
syntax checks passed
git status clean
pushed to origin/main
17 files changed
+322
-190
Undo

Review
server/controllers/agent-controller.js
server/controllers/auth-controller.js
server/controllers/planner-controller.js
server/controllers/project-controller.js
server/controllers/sprint-controller.js
server/controllers/status-controller.js
server/errors.js
server/index.js
server/middleware/async-route.js
server/middleware/error-handler.js
server/middleware/require-session.js
server/routes/auth-routes.js
server/routes/project-routes.js
server/services/planner-service.js
server/services/project-service.js
server/services/sprint-service.js
server/services/status-service.js




9:12 PM
continue, make the .env so i can run too
9:13 PM


Worked for 1m 51s
Yes. I added a local .env so the app can pass config validation:

DORCH_SESSION_PASSWORD=dorch-dev
Mongo URI set to mongodb://localhost:27017/dorch
API key fields left blank for you to fill in
I also added local run tooling and pushed it:

49cbcdb chore: add local run tooling

New commands:

npm run mongo:up
npm start
Docker is installed, but Docker Desktop is not currently running, so npm run mongo:up failed with the missing Docker engine pipe. Open Docker Desktop first, then run:

npm run mongo:up
npm start
Verification done:

npm test passes
.env is ignored and local only
repo is clean except ignored .env and node_modules/

README.md
Document · MD

Open

4 files changed
+50
-1
Undo

Review
.env
README.md
compose.yaml
package.json




9:15 PM
what do i need '
OPENAI_API_KEY=
ANTHROPIC_API_KEY='

for?
9:16 PM

Those are for the agent CLIs, not for Dorch’s server itself.

OPENAI_API_KEY: used by codex / Codex CLI when Dorch starts the codex-cli agent.
ANTHROPIC_API_KEY: used by claude / Claude CLI when Dorch starts the claude-cli agent or planner.
Dorch itself does not call OpenAI or Anthropic APIs directly. It spawns CLI tools as child processes, and those CLIs read their keys from the environment.

You can leave them blank for now if you only want to start the server/UI and test auth/project routes. You’ll need them once you want Dorch to actually run Codex/Claude agents.





9:16 PM
favicon.ico:1  Failed to load resource: the server responded with a status of 404 (Not Found)
Connecting to 'http://localhost:3000/.well-known/appspecific/com.chrome.devtools.json' violates the following Content Security Policy directive: "default-src 'none'". The request has been blocked. Note that 'connect-src' was not explicitly set, so 'default-src' is used as a fallback.

(index):1  Failed to load resource: the server responded with a status of 404 (Not Found)
9:19 PM


Worked for 1m 2s
Those were expected at this stage because there was no real UI bundle yet.

Fixed and pushed:

a370bf5 fix: add local app shell routes

Added:

GET / returns a minimal Dorch app shell instead of 404
GET /favicon.ico returns 204
GET /.well-known/appspecific/com.chrome.devtools.json returns 204
The Chrome DevTools CSP message should go away or at least stop being a server-side 404 issue. npm test still passes.

3 files changed
+80
-0
Undo

Review
server/controllers/ui-controller.js
server/index.js
server/routes/ui-routes.js




9:20 PM
whats next
9:20 PM

Next is to make the app usable beyond the placeholder shell.

Recommended order:

Verify local server fully

Start Docker Desktop
Run npm run mongo:up
Run npm start
Open http://localhost:3000
Confirm the backend starts cleanly with Mongo connected
Build the real Vite React UI

Create server/ui/
Add Projects, Login, Chat, Status, Logs, Plan, Handoff screens
Wire it to the existing Express API
Replace the placeholder / shell
Harden API behavior

Add route tests for auth and project creation
Add service tests with Mongo test setup
Improve errors around missing Docker/Mongo/git failures
Verify CLI adapters

Check actual installed codex --help and claude --help
Adjust adapter flags if needed
Add standalone adapter smoke scripts
The best next implementation step is the real UI scaffold, because the backend already has enough auth/project/sprint routes to connect to.


Web preview
Website
Open




9:21 PM
User attachment
onward good sir
9:23 PM


Worked for 4m 25s
Onward accomplished.

Built and pushed the first real mobile web UI:

7267002 feat: add mobile web ui scaffold

What changed:

Added server/ui/ Vite + React app
Added login screen using DORCH_SESSION_PASSWORD
Added projects list/create flow
Added project detail view with bottom tabs:
Status
Chat
Plan
Handoff
Wired UI to existing /auth and /projects APIs
Express now serves the built UI from server/ui/dist/index.html when present
Added root scripts:
npm run ui:install
npm run ui:build
Verified:

npm run ui:install
npm run ui:build
npm test
To see it:

npm run ui:build
npm start
Then open http://localhost:3000. Login password is currently dorch-dev from your local .env.


Web preview
Website
Open
8 files changed
+1011
-0
Undo

Review
.gitignore
package.json
server/controllers/ui-controller.js
server/ui/index.html
server/ui/package.json
server/ui/src/main.jsx
server/ui/src/styles.css
server/ui/vite.config.js




9:27 PM
continue
9:29 PM


Worked for 1m 57s
Continued and pushed:

611d4a6 feat: add session check and logs tab

Added:

GET /auth/session
UI now checks existing session on page refresh instead of always showing login
Added real Logs bottom tab
Logs tab loads run-log.md
Logs tab connects to /projects/:slug/logs/stream via SSE for live output
UI build still passes
Backend tests still pass
Run it with:

npm run ui:build
npm start
Then refresh the browser. If your session cookie is still valid, it should keep you in the app instead of dumping you back to login.

4 files changed
+114
-3
Undo

Review
server/controllers/auth-controller.js
server/routes/auth-routes.js
server/ui/src/main.jsx
server/ui/src/styles.css




9:31 PM
so im still hung up on the api keys for the models, i thought you just logged into your account for both models cli?
9:31 PM


Worked for 32s
You’re right. For the normal interactive CLIs, you usually log in once and the CLI stores auth locally.

What I found on this machine:

codex is installed and supports codex login.
claude is not installed right now.
Dorch currently does not require OPENAI_API_KEY or ANTHROPIC_API_KEY to start.
Those .env keys are only useful if you want the spawned CLI processes to authenticate via environment variables instead of their own stored login.
So for your setup, I’d treat them as optional and probably leave them blank:

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
Use CLI login instead:

codex login
And once Claude Code is installed:

claude
# then use its login flow, often /login inside Claude Code
Important Anthropic detail: their docs/help say if ANTHROPIC_API_KEY is set, Claude Code may use API-key billing instead of your Claude.ai subscription login. So leaving it blank is the safer default if you expect subscription-based Claude Code usage.

We should update the Dorch docs/comments to say: “prefer CLI login; env API keys are optional override.”





9:32 PM
install both

jacob@Critters-LT MINGW64 ~/OneDrive/desktop/Projects/crittercodes/dorch (main)
$ codex login
bash: codex: command not found
9:34 PM


Worked for 3m 47s
Installed both globally:

npm install -g @openai/codex @anthropic-ai/claude-code
Verified:

codex-cli 0.125.0
2.1.119 (Claude Code)
Your Git Bash can now see them at:

/c/Users/jacob/AppData/Roaming/npm/codex
/c/Users/jacob/AppData/Roaming/npm/claude
So this should work in your MINGW64 terminal now:

codex login
claude auth login
I also fixed Dorch’s adapters because the installed Codex CLI does not use the old guessed --prompt flag. Updated behavior:

Codex uses codex exec ... - and receives context through stdin.
Claude uses claude -p --permission-mode acceptEdits and receives context through stdin.
On Windows, Dorch uses codex.cmd / claude.cmd so Node can spawn them reliably.
README and .env.example now say API keys are optional and CLI login is preferred.
Pushed:

9e15677 fix: align adapters with installed cli auth