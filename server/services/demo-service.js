import { Project, Sprint, PlannerMessage } from '../../db/index.js';
import { initWorkspace } from '../../lib/git.js';
import { createBranch } from '../../lib/git.js';
import {
  initProject,
  writeProjectBrief,
  writeProjectSummary,
  writeCurrentSprint,
  writeCurrentTask,
  writeLatestHandoff,
  appendHandoffHistory,
  appendRunLog
} from '../../memory/index.js';

const SLUG = 'demo-auth-service';

const BRIEF = `# Project: auth-service

## What this is
A Node.js authentication service for CritterCodes apps. Handles JWT issuance,
refresh tokens, and user session management.

## Tech stack
- Node.js 20 + Express 4
- MongoDB via Mongoose
- Entry point: src/server.js
- Test command: npm test

## Constraints
- Do not modify src/legacy/auth-v1.js — in use by mobile app
- All tokens must use RS256 (not HS256)
`;

const SUMMARY = `# Project Summary

Last updated: sprint-01

## Current architecture
- src/server.js — Express app, wires routes + middleware
- src/auth/tokens.js — JWT issue/verify (RS256)
- src/auth/session.js — session middleware (extracted sprint-01)
- src/auth/validators.js — input validation (extracted sprint-01)
- src/models/user.js — Mongoose User schema

## Key decisions
- RS256 for all tokens — legacy requirement from mobile app
- Throw errors (not return null) for invalid tokens
- Do not touch src/legacy/auth-v1.js

## What's been built
- Token service: complete (sprint-01)
- Session middleware: complete (sprint-01)
- Input validators: complete (sprint-01)
`;

const CURRENT_SPRINT = `# Sprint 02 — rate-limiting

Goal: Add rate limiting to the auth endpoints to prevent brute-force attacks.
Status: ACTIVE
Branch: agent/sprint-02-rate-limiting

## Tasks
- [x] 1. Audit existing auth endpoints for rate-limit exposure
  - Acceptance: list of all endpoints with their current limits
- [x] 2. Add rate-limit middleware using express-rate-limit
  - Acceptance: middleware file exists, imported in server.js
- [ ] 3. Apply rate limiting to POST /auth/login (5 req/min)  ← CURRENT
  - Acceptance: npm test passes, login returns 429 after 5 rapid attempts
- [ ] 4. Apply rate limiting to POST /auth/refresh (10 req/min)
  - Acceptance: npm test passes, refresh returns 429 correctly
- [ ] 5. Add rate-limit headers to all auth responses
  - Acceptance: X-RateLimit-Limit and X-RateLimit-Remaining in responses
`;

const CURRENT_TASK = `# Current Task

**Task:** 3 of 5
**Description:** Apply rate limiting to POST /auth/login (5 req/min)
**Acceptance criteria:** npm test passes, login endpoint returns 429 after 5 rapid attempts

## What to do

Apply the rate-limit middleware (created in task 2) to POST /auth/login in
src/server.js. The limit is 5 requests per minute per IP.

## What not to do

Do not modify src/legacy/auth-v1.js. Do not touch any endpoint other than
POST /auth/login in this task.

## Related files

- src/server.js — wire the middleware here
- src/middleware/rate-limit.js — the middleware from task 2 (already exists)
- test/auth.test.js — tests to verify
`;

const HANDOFF = `## Handoff
Agent: codex
Reason: rate_limit
Task: Apply rate limiting to POST /auth/login (5 req/min)
Date: 2026-04-27T03:14:22Z

### Completed
- Reviewed all auth endpoints — only /auth/login and /auth/refresh lack rate limiting
- Created src/middleware/rate-limit.js with configurable limiter factory

### In Progress
- Wiring loginLimiter into src/server.js — import added, route not yet wrapped

### Files Changed
- src/middleware/rate-limit.js: new file — exports loginLimiter and refreshLimiter
- src/server.js: added import for loginLimiter (line 8)

### Issues / Blockers
- none

### Last Output
Writing src/middleware/rate-limit.js
Created rate limiter middleware
Adding import to server.js
Codex rate limit exceeded. Please wait before continuing.

### Next Step
Wrap the POST /auth/login route handler in src/server.js with loginLimiter — the import is already on line 8.
`;

const PLANNER_MESSAGES = [
  { from: 'user', text: 'Add rate limiting to the auth endpoints to prevent brute-force attacks.' },
  {
    from: 'planner',
    text: `Got it — sprint 02. Quick questions:
1. Which endpoints need limiting? (login, refresh, register, all?)
2. What limits? (requests per minute/IP)
3. Should rate-limit headers be exposed to clients?`
  },
  { from: 'user', text: 'Login and refresh for sure. 5/min for login, 10/min for refresh. Yes, expose the headers.' },
  {
    from: 'planner',
    text: `Perfect. Writing 5-task sprint plan:
1. Audit endpoints
2. Add rate-limit middleware
3. Apply to /auth/login (5/min)
4. Apply to /auth/refresh (10/min)
5. Add X-RateLimit headers

PLAN READY ✓ — approve to start agents.`
  },
  { from: 'user', text: 'Approved.' },
  {
    from: 'planner',
    text: 'Agents are running. Codex is on task 3/5 — applying rate limiting to /auth/login.'
  }
];

export async function seedDemo() {
  const existing = await Project.findOne({ slug: SLUG }).lean();
  if (existing) return { slug: SLUG, seeded: false, message: 'Demo project already exists' };

  initProject(SLUG);

  try {
    initWorkspace(SLUG);
    createBranch(SLUG, 'agent/sprint-02-rate-limiting');
  } catch {
    // workspace errors don't block the demo
  }

  writeProjectBrief(SLUG, BRIEF);
  writeProjectSummary(SLUG, SUMMARY);
  writeCurrentSprint(SLUG, CURRENT_SPRINT);
  writeCurrentTask(SLUG, CURRENT_TASK);
  writeLatestHandoff(SLUG, HANDOFF);
  appendHandoffHistory(SLUG, HANDOFF);

  const now = new Date('2026-04-27T03:00:00Z');
  const logEntries = [
    ['sprint:started', 'sprint-02 · rate-limiting'],
    ['agent:started', 'codex-cli'],
    ['step:signal', 'task 1'],
    ['step:complete', 'task 1 — tests passed'],
    ['agent:started', 'codex-cli (task 2)'],
    ['step:signal', 'task 2'],
    ['step:complete', 'task 2 — tests passed'],
    ['agent:started', 'codex-cli (task 3)'],
    ['trigger:received', 'rate_limit'],
    ['agent:stopped', 'codex-cli (signal: SIGTERM)'],
    ['handoff:written', 'switch #1'],
    ['agent:started', 'claude-cli']
  ];
  for (const [event, msg] of logEntries) {
    appendRunLog(SLUG, event, msg);
  }

  const project = await Project.create({ slug: SLUG, name: 'auth-service (demo)', repoUrl: '' });

  await Sprint.create({
    projectSlug: SLUG,
    n: 2,
    goal: 'Add rate limiting to the auth endpoints to prevent brute-force attacks.',
    status: 'ACTIVE',
    branch: 'agent/sprint-02-rate-limiting',
    createdAt: now
  });

  await Sprint.create({
    projectSlug: SLUG,
    n: 1,
    goal: 'Refactor auth module into separate files with full test coverage.',
    status: 'CLOSED',
    branch: 'agent/sprint-01-auth-refactor',
    createdAt: new Date('2026-04-25T10:00:00Z'),
    closedAt: new Date('2026-04-26T18:00:00Z')
  });

  let ts = new Date('2026-04-27T02:58:00Z');
  for (const msg of PLANNER_MESSAGES) {
    ts = new Date(ts.getTime() + 45000);
    await PlannerMessage.create({ projectSlug: SLUG, sprintN: 2, ...msg, ts });
  }

  return { slug: SLUG, seeded: true, message: 'Demo project created' };
}

export async function clearDemo() {
  await Project.deleteOne({ slug: SLUG });
  await Sprint.deleteMany({ projectSlug: SLUG });
  await PlannerMessage.deleteMany({ projectSlug: SLUG });
  return { cleared: true };
}
