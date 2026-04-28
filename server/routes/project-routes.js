import { Router } from 'express';
import * as agents from '../controllers/agent-controller.js';
import * as planner from '../controllers/planner-controller.js';
import * as projects from '../controllers/project-controller.js';
import * as runner from '../controllers/runner-controller.js';
import * as sprints from '../controllers/sprint-controller.js';
import * as status from '../controllers/status-controller.js';
import * as usage from '../controllers/usage-controller.js';
import { asyncRoute } from '../middleware/async-route.js';

export function projectRoutes() {
  const router = Router();

  router.post('/create', asyncRoute(projects.create));
  router.get('/', asyncRoute(projects.list));
  router.get('/:slug', asyncRoute(projects.detail));

  router.post('/:slug/sprints/create', asyncRoute(sprints.create));
  router.post('/:slug/sprints/:n/close', asyncRoute(sprints.close));
  router.post('/:slug/sprints/:n/merge', asyncRoute(sprints.merge));

  router.post('/:slug/planner/message', asyncRoute(planner.message));
  router.get('/:slug/planner/messages', asyncRoute(planner.messages));
  router.post('/:slug/planner/approve', asyncRoute(sprints.approvePlan));

  router.post('/:slug/agent/switch', agents.switchAgent);
  router.post('/:slug/agent/stop', agents.stopAgent);
  router.post('/:slug/agent/resume', agents.resumeAgent);

  router.get('/:slug/runner/status', asyncRoute(runner.getRunnerStatus));
  router.post('/:slug/runner/start', asyncRoute(runner.startRunner));
  router.post('/:slug/runner/stop', asyncRoute(runner.stopRunner));
  router.post('/:slug/runner/command', asyncRoute(runner.updateRunCommand));
  router.get('/:slug/runner/logs/stream', runner.streamRunnerLogs);

  router.get('/:slug/usage', asyncRoute(usage.getProjectUsage));
  router.get('/:slug/status', asyncRoute(status.getStatus));
  router.get('/:slug/logs/stream', status.streamLogs);
  router.get('/:slug/run-log', status.runLog);

  return router;
}
