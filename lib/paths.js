import path from 'node:path';
import { config } from '../config.js';

export function projectPath(slug) {
  return path.join(config.projectsDir, slug);
}

export function workspacePath(slug) {
  return path.join(projectPath(slug), 'workspace');
}

export function memoryPath(slug) {
  return path.join(projectPath(slug), 'memory');
}

export function plannerPath(slug) {
  return path.join(projectPath(slug), 'planner');
}
