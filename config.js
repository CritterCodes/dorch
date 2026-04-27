import 'dotenv/config';
import path from 'node:path';

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function listEnv(name, fallback) {
  const raw = process.env[name];
  return (raw || fallback).split(',').map((item) => item.trim()).filter(Boolean);
}

export const config = Object.freeze({
  rootDir: process.cwd(),
  projectsDir: path.join(process.cwd(), 'projects'),
  port: intEnv('DORCH_PORT', 3000),
  mongoUri: process.env.DORCH_MONGO_URI || 'mongodb://localhost:27017/dorch',
  sessionSecret: process.env.DORCH_SESSION_SECRET || '',
  sessionPassword: process.env.DORCH_SESSION_PASSWORD || '',
  sessionMaxAgeMs: intEnv('DORCH_SESSION_MAX_AGE_MS', 604800000),
  primaryAgent: process.env.DORCH_PRIMARY_AGENT || 'codex-cli',
  agents: listEnv('DORCH_AGENTS', 'codex-cli,claude-cli'),
  noOutputTimeoutMs: intEnv('DORCH_NO_OUTPUT_TIMEOUT_MS', 180000),
  maxRuntimeMs: intEnv('DORCH_MAX_RUNTIME_MS', 2700000),
  killTimeoutMs: intEnv('DORCH_KILL_TIMEOUT_MS', 5000),
  rateLimitCooldownMs: intEnv('DORCH_RATE_LIMIT_COOLDOWN_MS', 90000),
  maxSwitchesPerTask: intEnv('DORCH_MAX_SWITCHES_PER_TASK', 6),
  maxConsecutiveFailures: intEnv('DORCH_MAX_CONSECUTIVE_FAILURES', 3),
  requirePlanApproval: boolEnv('DORCH_REQUIRE_PLAN_APPROVAL', true),
  sprintBranchPrefix: process.env.DORCH_SPRINT_BRANCH_PREFIX || 'agent/sprint-',
  defaultRemoteTemplate: process.env.DORCH_DEFAULT_REMOTE_TEMPLATE || '',
  testCommand: process.env.DORCH_TEST_COMMAND || 'npm test',
  maxContextChars: intEnv('DORCH_MAX_CONTEXT_CHARS', 32000)
});

export function validateConfig(cfg = config) {
  const missing = [];
  if (!cfg.sessionSecret) missing.push('DORCH_SESSION_SECRET');
  if (!cfg.sessionPassword) missing.push('DORCH_SESSION_PASSWORD');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
