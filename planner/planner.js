import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandName } from '../agents/shared.js';
import { memoryPath, plannerPath, workspacePath } from '../lib/paths.js';
import { logSummary } from '../lib/git.js';
import {
  readCurrentSprint,
  readLatestHandoff,
  readProjectBrief,
  readProjectSummary,
  writeCurrentSprint,
  writeCurrentTask,
  writeProjectSummary,
  writeSprintSummary
} from '../memory/index.js';

function conversationFile(slug) {
  return path.join(plannerPath(slug), 'current-conversation.jsonl');
}

function appendTurn(slug, from, text) {
  fs.appendFileSync(conversationFile(slug), JSON.stringify({ from, text, ts: new Date().toISOString() }) + '\n');
}

function runClaude(slug, prompt) {
  const result = spawnSync(commandName('claude'), [
    '-p',
    '--permission-mode', 'acceptEdits',
    '--add-dir', memoryPath(slug)
  ], {
    input: prompt,
    cwd: workspacePath(slug),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 5
  });
  if (result.error) return { ok: false, text: result.error.message };
  if (result.status !== 0) return { ok: false, text: result.stderr || result.stdout || `claude exited ${result.status}` };
  return { ok: true, text: result.stdout.trim() };
}

function readPackageJson(slug) {
  const file = path.join(workspacePath(slug), 'package.json');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export async function startSprint(slug, goal, sprintN) {
  const message = `Sprint ${String(sprintN).padStart(2, '0')} created. Describe constraints or acceptance criteria, then ask me to write the plan.`;
  appendTurn(slug, 'planner', message);
  return { message };
}

export async function reply(slug, sprintN, userMessage) {
  appendTurn(slug, 'user', userMessage);
  if (userMessage.startsWith('/recall')) {
    const message = 'Recall noted. Sprint summary recall will be included in the next planner generation pass.';
    appendTurn(slug, 'planner', message);
    return { message, planReady: false };
  }

  const history = fs.readFileSync(conversationFile(slug), 'utf8');
  const mem = memoryPath(slug);
  const prompt = [
    'You are Dorch Planner. Ask concise clarification questions or write the plan when ready.',
    `Write current plan files for project "${slug}" only when ready.`,
    `Target sprint file: ${path.join(mem, 'current-sprint.md')}`,
    `Target task file: ${path.join(mem, 'current-task.md')}`,
    'When files are written, output exactly PLAN READY.',
    '',
    `SPRINT: ${sprintN}`,
    `PROJECT BRIEF:\n${readProjectBrief(slug)}`,
    `PROJECT SUMMARY:\n${readProjectSummary(slug)}`,
    `PACKAGE JSON:\n${readPackageJson(slug)}`,
    `GIT LOG:\n${logSummary(slug)}`,
    `CONVERSATION:\n${history}`
  ].join('\n\n');

  const claude = runClaude(slug, prompt);
  const message = claude.ok ? claude.text : `Planner CLI unavailable: ${claude.text}`;
  const planReady = /\bPLAN READY\b/i.test(message);
  appendTurn(slug, 'planner', message);

  if (!planReady && /write plan/i.test(userMessage)) {
    writeCurrentSprint(slug, `# Sprint ${String(sprintN).padStart(2, '0')}\n\nStatus: PLANNED\n\n## Tasks\n- [ ] 1. Implement the requested sprint goal\n  - Acceptance: documented acceptance criteria pass\n`);
    writeCurrentTask(slug, '# Current Step\n\n**Step:** 1 of 1\n**Description:** Implement the requested sprint goal\n**Acceptance criteria:** documented acceptance criteria pass\n');
    return { message: `${message}\n\nPLAN READY`, planReady: true };
  }

  return { message, planReady };
}

export async function closeSprint(slug, sprintN) {
  const summary = [
    `# Sprint ${String(sprintN).padStart(2, '0')}`,
    '',
    `Closed: ${new Date().toISOString()}`,
    '',
    '## Goal',
    readCurrentSprint(slug),
    '',
    '## Latest Handoff',
    readLatestHandoff(slug)
  ].join('\n');
  writeSprintSummary(slug, sprintN, summary);
  writeProjectSummary(slug, `# Project Summary\n\nLast updated: sprint-${String(sprintN).padStart(2, '0')}\n\n## Current architecture\n- See sprint summary for latest changes.\n`);
  return summary;
}
