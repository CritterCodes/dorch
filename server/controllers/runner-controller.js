import { config } from '../../config.js';
import { Project } from '../../db/index.js';
import { notFound } from '../errors.js';

function ensureRunner(req) {
  req.app.locals.bus.emit('runner:ensure', { slug: req.params.slug });
  return req.app.locals.runners.get(req.params.slug);
}

export async function getRunnerStatus(req, res) {
  const { slug } = req.params;
  const runner = req.app.locals.runners.get(slug);
  const project = await Project.findOne({ slug }).lean();
  if (!project) throw notFound('project not found');
  res.json({
    state: runner?.state || 'IDLE',
    port: project.runPort || null,
    command: project.runCommand || 'npm run dev',
    publicHost: config.publicHost
  });
}

export async function startRunner(req, res) {
  const { slug } = req.params;
  let project = await Project.findOne({ slug });
  if (!project) throw notFound('project not found');

  if (!project.runPort) {
    const taken = await Project.find({ runPort: { $ne: null } }).distinct('runPort');
    let port = config.baseRunPort;
    while (taken.includes(port)) port++;
    project.runPort = port;
    await project.save();
  }

  const runner = ensureRunner(req);
  runner.start(project.runCommand || 'npm run dev', project.runPort);
  res.json({ ok: true, port: project.runPort });
}

export async function stopRunner(req, res) {
  const runner = req.app.locals.runners.get(req.params.slug);
  runner?.stop();
  res.json({ ok: true });
}

export async function updateRunCommand(req, res) {
  const { slug } = req.params;
  const command = String(req.body?.command || '').trim() || 'npm run dev';
  await Project.updateOne({ slug }, { runCommand: command });
  res.json({ ok: true });
}

export function streamRunnerLogs(req, res) {
  const runner = req.app.locals.runners.get(req.params.slug);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();

  for (const line of runner?.lines || []) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  const onLine = (line) => res.write(`data: ${JSON.stringify(line)}\n\n`);
  runner?.on('line', onLine);
  req.on('close', () => runner?.off('line', onLine));
}
