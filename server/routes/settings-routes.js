import { Router } from 'express';
import * as settings from '../controllers/settings-controller.js';
import { asyncRoute } from '../middleware/async-route.js';

export function settingsRoutes() {
  const router = Router();
  router.get('/', asyncRoute(settings.getSettings));
  router.post('/', asyncRoute(settings.updateSettings));
  return router;
}
