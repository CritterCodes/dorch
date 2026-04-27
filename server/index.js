import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'node:path';
import { config } from '../config.js';
import { Project, Sprint, PlannerMessage } from '../db/index.js';
import { slugify } from '../lib/slug.js';
import { cloneWorkspace, createBranch, initWorkspace, mergeBranch } from '../lib/git.js';
import { initProject, readCurrentSprint, readLatestHandoff, readRunLog, writeCurrentSprint } from '../memory/index.js';
import * as planner from '../planner/planner.js';

function requireSession(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'unauthorized' });
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function sprintSlug(goal) {
  return slugify(goal, 30);
}

export function createServer({ bus }) {
  const app = express();
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

  app.post('/auth/login', (req, res) => {
    if (req.body?.password !== config.sessionPassword) {
      res.status(401).json({ error: 'invalid password' });
      return;
    }
    req.session.authenticated = true;
    res.json({ ok: true });
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.use('/projects', requireSession);

  app.post('/projects/create', asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const repoUrl = String(req.body?.repoUrl || '').trim();
    const remoteUrl = String(req.body?.remoteUrl || '').trim();
    const slug = slugify(name);
    if (await Project.exists({ slug })) {
      res.status(409).json({ error: 'project already exists', slug });
      return;
    }

    initProject(slug);
    if (repoUrl) cloneWorkspace(slug, repoUrl);
    else initWorkspace(slug, remoteUrl || config.defaultRemoteTemplate.replaceAll('{slug}', slug));

    const project = await Project.create({ slug, name, repoUrl });
    res.status(201).json(project);
  }));

  app.get('/projects', asyncRoute(async (_req, res) => {
    res.json(await Project.find({ archivedAt: null }).sort({ createdAt: -1 }).lean());
  }));

  app.get('/projects/:slug', asyncRoute(async (req, res) => {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    const sprints = await Sprint.find({ projectSlug: req.params.slug }).sort({ n: 1 }).lean();
    res.json({ project, sprints });
  }));

  app.post('/projects/:slug/sprints/create', asyncRoute(async (req, res) => {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    const goal = String(req.body?.goal || '').trim();
    if (!goal) {
      res.status(400).json({ error: 'goal is required' });
      return;
    }
    const n = await Sprint.countDocuments({ projectSlug: req.params.slug }) + 1;
    const nPadded = String(n).padStart(2, '0');
    const branch = `${config.sprintBranchPrefix}${nPadded}-${sprintSlug(goal)}`;
    const sprint = await Sprint.create({ projectSlug: req.params.slug, n, goal, branch });
    writeCurrentSprint(req.params.slug, `# Sprint ${nPadded} - ${sprintSlug(goal)}\n\nGoal: ${goal}\nStatus: PLANNED\nBranch: ${branch}\n\n## Tasks\n- [ ] 1. Planner conversation pending\n  - Acceptance: sprint plan approved\n`);
    createBranch(req.params.slug, branch);
    const firstMessage = await planner.startSprint(req.params.slug, goal, n);
    res.status(201).json({ sprint, message: firstMessage.message });
  }));

  app.post('/projects/:slug/planner/message', asyncRoute(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const sprint = await Sprint.findOne({ projectSlug: req.params.slug }).sort({ n: -1 }).lean();
    if (!sprint) {
      res.status(404).json({ error: 'no sprint found' });
      return;
    }
    const result = await planner.reply(req.params.slug, sprint.n, text);
    await PlannerMessage.insertMany([
      { projectSlug: req.params.slug, sprintN: sprint.n, from: 'user', text },
      { projectSlug: req.params.slug, sprintN: sprint.n, from: 'planner', text: result.message }
    ]);
    res.json(result);
  }));

  app.get('/projects/:slug/planner/messages', asyncRoute(async (req, res) => {
    const sprint = await Sprint.findOne({ projectSlug: req.params.slug }).sort({ n: -1 }).lean();
    if (!sprint) {
      res.json([]);
      return;
    }
    res.json(await PlannerMessage.find({ projectSlug: req.params.slug, sprintN: sprint.n }).sort({ ts: 1 }).lean());
  }));

  app.post('/projects/:slug/planner/approve', asyncRoute(async (req, res) => {
    const sprint = await Sprint.findOneAndUpdate(
      { projectSlug: req.params.slug, status: 'PLANNED' },
      { status: 'ACTIVE' },
      { sort: { n: -1 }, new: true }
    ).lean();
    if (!sprint) {
      res.status(404).json({ error: 'planned sprint not found' });
      return;
    }
    bus.emit('runtime:ensure', { slug: req.params.slug });
    bus.emit('sprint:approved', { slug: req.params.slug, sprintN: sprint.n });
    res.json({ ok: true, sprint });
  }));

  app.post('/projects/:slug/sprints/:n/close', asyncRoute(async (req, res) => {
    const summary = await planner.closeSprint(req.params.slug, Number(req.params.n));
    await Sprint.updateOne({ projectSlug: req.params.slug, n: Number(req.params.n) }, { status: 'REVIEW', closedAt: new Date() });
    res.json({ summary });
  }));

  app.post('/projects/:slug/sprints/:n/merge', asyncRoute(async (req, res) => {
    const sprint = await Sprint.findOne({ projectSlug: req.params.slug, n: Number(req.params.n) }).lean();
    if (!sprint) {
      res.status(404).json({ error: 'sprint not found' });
      return;
    }
    mergeBranch(req.params.slug, sprint.branch, 'main');
    await Sprint.updateOne({ _id: sprint._id }, { status: 'CLOSED' });
    res.json({ ok: true });
  }));

  app.post('/projects/:slug/agent/switch', (req, res) => {
    bus.emit('runtime:ensure', { slug: req.params.slug });
    bus.emit('trigger', { slug: req.params.slug, type: 'manual', raw: req.body?.reason || 'user override' });
    res.json({ ok: true });
  });

  app.post('/projects/:slug/agent/stop', (req, res) => {
    bus.emit('runtime:ensure', { slug: req.params.slug });
    bus.emit('agent:stop_requested', { slug: req.params.slug });
    res.json({ ok: true });
  });

  app.get('/projects/:slug/status', asyncRoute(async (req, res) => {
    const sprint = await Sprint.findOne({ projectSlug: req.params.slug }).sort({ n: -1 }).lean();
    res.json({
      sprint,
      currentSprint: readCurrentSprint(req.params.slug),
      latestHandoff: readLatestHandoff(req.params.slug)
    });
  }));

  app.get('/projects/:slug/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();
    const onLine = (line) => {
      if (line.slug === req.params.slug) res.write(`data: ${JSON.stringify(line)}\n\n`);
    };
    bus.on('log:line', onLine);
    req.on('close', () => bus.off('log:line', onLine));
  });

  app.get('/projects/:slug/run-log', (req, res) => {
    res.type('text/plain').send(readRunLog(req.params.slug));
  });

  app.use(express.static(path.join(config.rootDir, 'server', 'ui', 'dist')));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return { app };
}
