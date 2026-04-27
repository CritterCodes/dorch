export function requireSession(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'unauthorized' });
}
