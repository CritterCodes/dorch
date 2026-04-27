import { PlannerMessage } from '../../db/index.js';
import * as planner from '../../planner/planner.js';
import { badRequest, notFound } from '../errors.js';
import { latestSprint } from './sprint-service.js';

export async function sendPlannerMessage(slug, { text }) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw badRequest('text is required');

  const sprint = await latestSprint(slug);
  if (!sprint) throw notFound('no sprint found');

  const result = await planner.reply(slug, sprint.n, cleanText);
  await PlannerMessage.insertMany([
    { projectSlug: slug, sprintN: sprint.n, from: 'user', text: cleanText },
    { projectSlug: slug, sprintN: sprint.n, from: 'planner', text: result.message }
  ]);
  return result;
}

export async function listPlannerMessages(slug) {
  const sprint = await latestSprint(slug);
  if (!sprint) return [];
  return PlannerMessage.find({ projectSlug: slug, sprintN: sprint.n }).sort({ ts: 1 }).lean();
}
