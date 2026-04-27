import { config } from '../../config.js';
import { Project, Sprint } from '../../db/index.js';
import { cloneWorkspace, initWorkspace } from '../../lib/git.js';
import { slugify } from '../../lib/slug.js';
import { initProject } from '../../memory/index.js';
import { badRequest, conflict, notFound } from '../errors.js';

export async function createProject({ name, repoUrl = '', remoteUrl = '' }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw badRequest('name is required');

  const slug = slugify(cleanName);
  if (await Project.exists({ slug })) {
    throw conflict('project already exists', { slug });
  }

  initProject(slug);
  const cleanRepoUrl = String(repoUrl || '').trim();
  const cleanRemoteUrl = String(remoteUrl || '').trim();
  if (cleanRepoUrl) cloneWorkspace(slug, cleanRepoUrl);
  else initWorkspace(slug, cleanRemoteUrl || config.defaultRemoteTemplate.replaceAll('{slug}', slug));

  return Project.create({ slug, name: cleanName, repoUrl: cleanRepoUrl });
}

export async function listProjects() {
  return Project.find({ archivedAt: null }).sort({ createdAt: -1 }).lean();
}

export async function getProjectDetail(slug) {
  const project = await Project.findOne({ slug }).lean();
  if (!project) throw notFound('project not found');
  const sprints = await Sprint.find({ projectSlug: slug }).sort({ n: 1 }).lean();
  return { project, sprints };
}

export async function assertProjectExists(slug) {
  const project = await Project.findOne({ slug }).lean();
  if (!project) throw notFound('project not found');
  return project;
}
