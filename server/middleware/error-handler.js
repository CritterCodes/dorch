import { HttpError } from '../errors.js';

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...err.details });
    return;
  }
  res.status(500).json({ error: err.message });
}
