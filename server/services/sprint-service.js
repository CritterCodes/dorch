import { config } from '../../config.js';
import { Sprint } from '../../db/index.js';
import { createBranch, mergeBranch } from '../../lib/git.js';
import { slugify } from '../../lib/slug.js';
import { writeCurrentSprint } from '../../memory/index.js';
import * as planner from '../../planner/planner.js';
import { badRequest, notFound } from '../errors.js';
import { assertProjectExists } from './project-service.js';

function sprintSlug(goal) {
  return slugify(goal, 30);
}

function sprintNumber(n) {
  return String(n).padStart(2, '0');
}

export async function createSprint(slug, { goal }) {
  await assertProjectExists(slug);
  const cleanGoal = String(goal || '').trim();
  if (!cleanGoal) throw badRequest('goal is required');

  const n = await Sprint.countDocuments({ projectSlug: slug }) + 1;
  const nPadded = sprintNumber(n);
  const branch = `${config.sprintBranchPrefix}${nPadded}-${sprintSlug(cleanGoal)}`;
  const sprint = await Sprint.create({ projectSlug: slug, n, goal: cleanGoal, branch });

  writeCurrentSprint(slug, `# Sprint ${nPadded} - ${sprintSlug(cleanGoal)}\n\nGoal: ${cleanGoal}\nStatus: PLANNED\nBranch: ${branch}\n\n## Tasks\n- [ ] 1. Planner conversation pending\n  - Acceptance: sprint plan approved\n`);
  createBranch(slug, branch);
  const firstMessage = await planner.startSprint(slug, cleanGoal, n);
  return { sprint, message: firstMessage.message };
}

export async function approveLatestPlan(slug) {
  const sprint = await Sprint.findOneAndUpdate(
    { projectSlug: slug, status: 'PLANNED' },
    { status: 'ACTIVE' },
    { sort: { n: -1 }, new: true }
  ).lean();
  if (!sprint) throw notFound('planned sprint not found');
  return sprint;
}

export async function closeSprint(slug, n) {
  const sprintN = Number(n);
  const summary = await planner.closeSprint(slug, sprintN);
  await Sprint.updateOne({ projectSlug: slug, n: sprintN }, { status: 'REVIEW', closedAt: new Date() });
  return { summary };
}

export async function mergeSprint(slug, n) {
  const sprint = await Sprint.findOne({ projectSlug: slug, n: Number(n) }).lean();
  if (!sprint) throw notFound('sprint not found');
  mergeBranch(slug, sprint.branch, 'main');
  await Sprint.updateOne({ _id: sprint._id }, { status: 'CLOSED' });
  return { ok: true };
}

export async function latestSprint(slug) {
  return Sprint.findOne({ projectSlug: slug }).sort({ n: -1 }).lean();
}
