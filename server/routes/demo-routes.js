import { Router } from 'express';
import * as demo from '../controllers/demo-controller.js';
import { asyncRoute } from '../middleware/async-route.js';

export function demoRoutes() {
  const router = Router();
  router.post('/seed', asyncRoute(demo.seed));
  router.post('/clear', asyncRoute(demo.clear));
  return router;
}
