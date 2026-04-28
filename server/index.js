import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'node:path';
import { config } from '../config.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireSession } from './middleware/require-session.js';
import { authRoutes } from './routes/auth-routes.js';
import { demoRoutes } from './routes/demo-routes.js';
import { projectRoutes } from './routes/project-routes.js';
import { settingsRoutes } from './routes/settings-routes.js';
import { uiRoutes } from './routes/ui-routes.js';

export function createServer({ bus, runtimes, runners }) {
  const app = express();

  app.locals.bus = bus;
  app.locals.runtimes = runtimes;
  app.locals.runners = runners;

  app.use(express.json({ limit: '1mb' }));
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: config.mongoUri }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.sessionMaxAgeMs
    }
  }));

  app.use(uiRoutes());
  app.use('/auth', authRoutes());
  app.use('/demo', requireSession, demoRoutes());
  app.use('/settings', requireSession, settingsRoutes());
  app.use('/projects', requireSession, projectRoutes());
  app.use(express.static(path.join(config.rootDir, 'server', 'ui', 'dist')));
  app.use(errorHandler);

  return { app };
}
