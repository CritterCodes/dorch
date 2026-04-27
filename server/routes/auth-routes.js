import { Router } from 'express';
import * as auth from '../controllers/auth-controller.js';

export function authRoutes() {
  const router = Router();
  router.post('/login', auth.login);
  router.post('/logout', auth.logout);
  return router;
}
