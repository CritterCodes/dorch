import { config } from '../../config.js';
import { Project, Sprint } from '../../db/index.js';
import { cloneWorkspace, createGithubRepo, initWorkspace } from '../../lib/git.js';
import { slugify } from '../../lib/slug.js';
import { initProject } from '../../memory/index.js';
import { badRequest, conflict, notFound } from '../errors.js';

export async function createProject({ name, repoUrl = '' }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw badRequest('name is required');

  const slug = slugify(cleanName);
  if (await Project.exists({ slug })) throw conflict('project already exists', { slug });

  initProject(slug);

  let resolvedRepoUrl = String(repoUrl || '').trim();
  if (resolvedRepoUrl) {
    cloneWorkspace(slug, resolvedRepoUrl);
  } else {
    initWorkspace(slug);
    if (config.githubOwner) {
      resolvedRepoUrl = createGithubRepo(slug, config.githubOwner);
    }
  }

  return Project.create({ slug, name: cleanName, repoUrl: resolvedRepoUrl });
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
