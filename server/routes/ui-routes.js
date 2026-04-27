import { Router } from 'express';
import * as ui from '../controllers/ui-controller.js';

export function uiRoutes() {
  const router = Router();
  router.get('/', ui.appShell);
  router.get('/favicon.ico', ui.favicon);
  router.get('/.well-known/appspecific/com.chrome.devtools.json', ui.chromeDevToolsProbe);
  return router;
}
