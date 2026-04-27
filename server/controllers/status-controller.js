import * as status from '../services/status-service.js';

export async function getStatus(req, res) {
  res.json(await status.getStatus(req.params.slug));
}

export function streamLogs(req, res) {
  const bus = req.app.locals.bus;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();
  const onLine = (line) => {
    if (line.slug === req.params.slug) res.write(`data: ${JSON.stringify(line)}\n\n`);
  };
  bus.on('log:line', onLine);
  req.on('close', () => bus.off('log:line', onLine));
}

export function runLog(req, res) {
  res.type('text/plain').send(status.getRunLog(req.params.slug));
}
