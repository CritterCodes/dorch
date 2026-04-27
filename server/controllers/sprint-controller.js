import * as sprints from '../services/sprint-service.js';

export async function create(req, res) {
  res.status(201).json(await sprints.createSprint(req.params.slug, req.body || {}));
}

export async function approvePlan(req, res) {
  const sprint = await sprints.approveLatestPlan(req.params.slug);
  req.app.locals.bus.emit('runtime:ensure', { slug: req.params.slug });
  req.app.locals.bus.emit('sprint:approved', { slug: req.params.slug, sprintN: sprint.n });
  res.json({ ok: true, sprint });
}

export async function close(req, res) {
  res.json(await sprints.closeSprint(req.params.slug, req.params.n));
}

export async function merge(req, res) {
  res.json(await sprints.mergeSprint(req.params.slug, req.params.n));
}
