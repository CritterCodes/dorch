export function switchAgent(req, res) {
  const bus = req.app.locals.bus;
  bus.emit('runtime:ensure', { slug: req.params.slug });
  bus.emit('trigger', { slug: req.params.slug, type: 'manual', raw: req.body?.reason || 'user override' });
  res.json({ ok: true });
}

export function stopAgent(req, res) {
  const bus = req.app.locals.bus;
  bus.emit('runtime:ensure', { slug: req.params.slug });
  bus.emit('agent:stop_requested', { slug: req.params.slug });
  res.json({ ok: true });
}
