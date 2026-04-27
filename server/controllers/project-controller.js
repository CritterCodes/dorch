import * as projects from '../services/project-service.js';

export async function create(req, res) {
  res.status(201).json(await projects.createProject(req.body || {}));
}

export async function list(_req, res) {
  res.json(await projects.listProjects());
}

export async function detail(req, res) {
  res.json(await projects.getProjectDetail(req.params.slug));
}
