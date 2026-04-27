import { clearDemo, seedDemo } from '../services/demo-service.js';

export async function seed(req, res) {
  const result = await seedDemo();
  res.json(result);
}

export async function clear(req, res) {
  const result = await clearDemo();
  res.json(result);
}
