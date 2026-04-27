import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { memoryPath, plannerPath, projectPath, workspacePath } from '../lib/paths.js';

const files = {
  projectBrief: 'project-brief.md',
  projectSummary: 'project-summary.md',
  currentSprint: 'current-sprint.md',
  currentTask: 'current-task.md',
  latestHandoff: 'latest-handoff.md',
  handoffHistory: 'handoff-history.md',
  runLog: 'run-log.md',
  reviewNotes: 'review-notes.md'
};

function ensureFile(filePath, content = '') {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content);
}

function read(slug, file) {
  return fs.readFileSync(path.join(memoryPath(slug), file), 'utf8');
}

function write(slug, file, content) {
  fs.writeFileSync(path.join(memoryPath(slug), file), content);
}

export function initProject(slug) {
  fs.mkdirSync(workspacePath(slug), { recursive: true });
  fs.mkdirSync(path.join(memoryPath(slug), 'sprints'), { recursive: true });
  fs.mkdirSync(plannerPath(slug), { recursive: true });
  ensureFile(path.join(memoryPath(slug), files.projectBrief), '# Project\nNo brief defined yet.\n');
  ensureFile(path.join(memoryPath(slug), files.projectSummary), '# Project Summary\nNo sprints completed yet.\n');
  ensureFile(path.join(memoryPath(slug), files.currentSprint), '# Sprint\nNo active sprint.\n');
  ensureFile(path.join(memoryPath(slug), files.currentTask), '# Current Task\nNo task active.\n');
  ensureFile(path.join(memoryPath(slug), files.latestHandoff), '# Handoff\nNo prior handoff. This is the first agent run.\n');
  ensureFile(path.join(memoryPath(slug), files.handoffHistory), '');
  ensureFile(path.join(memoryPath(slug), files.runLog), '');
  ensureFile(path.join(memoryPath(slug), files.reviewNotes), '');
  ensureFile(path.join(plannerPath(slug), 'current-conversation.jsonl'), '');
}

export function initExistingProjects() {
  if (!fs.existsSync(config.projectsDir)) return;
  for (const entry of fs.readdirSync(config.projectsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) initProject(entry.name);
  }
}

export function getProjectSlugs() {
  if (!fs.existsSync(config.projectsDir)) return [];
  return fs.readdirSync(config.projectsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function hasUncleanShutdown(slug) {
  try {
    const log = readRunLog(slug);
    let pending = false;
    for (const line of log.split('\n')) {
      if (line.includes('[agent:started]')) pending = true;
      else if (line.includes('[agent:stopped]') || line.includes('[recovery:')) pending = false;
    }
    return pending;
  } catch {
    return false;
  }
}

export const readProjectBrief = (slug) => read(slug, files.projectBrief);
export const writeProjectBrief = (slug, str) => write(slug, files.projectBrief, str);
export const readProjectSummary = (slug) => read(slug, files.projectSummary);
export const writeProjectSummary = (slug, str) => write(slug, files.projectSummary, str);
export const readCurrentSprint = (slug) => read(slug, files.currentSprint);
export const writeCurrentSprint = (slug, str) => write(slug, files.currentSprint, str);
export const readCurrentTask = (slug) => read(slug, files.currentTask);
export const writeCurrentTask = (slug, str) => write(slug, files.currentTask, str);
export const readLatestHandoff = (slug) => read(slug, files.latestHandoff);
export const writeLatestHandoff = (slug, str) => write(slug, files.latestHandoff, str);
export const readRunLog = (slug) => read(slug, files.runLog);
export const readReviewNotes = (slug) => read(slug, files.reviewNotes);
export const writeReviewNotes = (slug, str) => write(slug, files.reviewNotes, str);

export function readSprintSummary(slug, n) {
  return fs.readFileSync(path.join(memoryPath(slug), 'sprints', `sprint-${String(n).padStart(2, '0')}.md`), 'utf8');
}

export function writeSprintSummary(slug, n, str) {
  fs.writeFileSync(path.join(memoryPath(slug), 'sprints', `sprint-${String(n).padStart(2, '0')}.md`), str);
}

export function appendHandoffHistory(slug, str) {
  fs.appendFileSync(path.join(memoryPath(slug), files.handoffHistory), `\n---\n<!-- handoff ${new Date().toISOString()} -->\n${str}\n`);
}

export function appendRunLog(slug, event, msg = '') {
  fs.appendFileSync(path.join(memoryPath(slug), files.runLog), `[${new Date().toISOString()}] [${event}] ${msg}`.trimEnd() + '\n');
}

function trimHandoff(text) {
  if (text.length <= 4800) return text;
  const indexes = ['Agent:', 'Reason:', 'Task:', 'Date:']
    .map((needle) => text.indexOf(needle))
    .filter((idx) => idx >= 0);
  const requiredIndex = indexes.length ? Math.min(...indexes) : -1;
  const lastOutput = text.indexOf('### Last Output');
  const nextStep = text.indexOf('### Next Step');
  const required = requiredIndex >= 0 ? text.slice(requiredIndex, text.indexOf('\n### Completed')) : '';
  const tailStart = [lastOutput, nextStep].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
  const tail = tailStart >= 0 ? text.slice(tailStart) : text.slice(-2400);
  return `## Handoff\n${required}\n\n${tail}`.slice(-4800);
}

export function assembleContext(slug) {
  const latestHandoffRaw = readLatestHandoff(slug);
  const context = {
    projectBrief: readProjectBrief(slug),
    projectSummary: readProjectSummary(slug),
    currentSprint: readCurrentSprint(slug),
    currentTask: readCurrentTask(slug),
    latestHandoff: trimHandoff(latestHandoffRaw)
  };
  return {
    ...context,
    isFirstRun: latestHandoffRaw.includes('No prior handoff')
  };
}

export function projectExists(slug) {
  return fs.existsSync(projectPath(slug));
}
