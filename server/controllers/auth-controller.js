import { config } from '../../config.js';

export function login(req, res) {
  if (req.body?.password !== config.sessionPassword) {
    res.status(401).json({ error: 'invalid password' });
    return;
  }
  req.session.authenticated = true;
  res.json({ ok: true });
}

export function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}
