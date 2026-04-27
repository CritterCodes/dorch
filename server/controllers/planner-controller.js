import * as planner from '../services/planner-service.js';

export async function message(req, res) {
  res.json(await planner.sendPlannerMessage(req.params.slug, req.body || {}));
}

export async function messages(req, res) {
  res.json(await planner.listPlannerMessages(req.params.slug));
}
