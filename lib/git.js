import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { workspacePath } from './paths.js';

function gh(args, options = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function git(slug, args, options = {}) {
  return execFileSync('git', args, {
    cwd: workspacePath(slug),
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  }).trim();
}

export function cloneWorkspace(slug, repoUrl) {
  const cwd = path.dirname(workspacePath(slug));
  execFileSync('git', ['clone', repoUrl, 'workspace'], { cwd, stdio: 'inherit' });
}

export function initWorkspace(slug) {
  const workspace = workspacePath(slug);
  fs.mkdirSync(workspace, { recursive: true });
  execFileSync('git', ['init', '-b', 'main'], { cwd: workspace, stdio: 'ignore' });
  fs.writeFileSync(path.join(workspace, 'README.md'), `# ${slug}\n`, { flag: 'wx' });
  git(slug, ['add', 'README.md']);
  git(slug, ['commit', '-m', 'chore: initial workspace']);
}

export function createGithubRepo(slug, owner) {
  const repoName = `${owner}/${slug}`;
  // Create private GitHub repo — succeeds even if it already exists (exits non-zero but we ignore)
  try {
    gh(['repo', 'create', repoName, '--private'], { stdio: 'inherit' });
  } catch {
    // repo may already exist; continue to wire remote and push
  }
  const remoteUrl = `https://github.com/${repoName}`;
  git(slug, ['remote', 'add', 'origin', remoteUrl]);
  git(slug, ['push', '-u', 'origin', 'main'], { stdio: 'inherit' });
  return remoteUrl;
}

export function createBranch(slug, branchName) {
  return git(slug, ['checkout', '-b', branchName]);
}

export function mergeBranch(slug, branch, into = 'main') {
  git(slug, ['checkout', into]);
  return git(slug, ['merge', '--no-ff', branch]);
}

export function currentBranch(slug) {
  return git(slug, ['branch', '--show-current']);
}

export function diffStat(slug) {
  return git(slug, ['diff', '--stat']);
}

export function logSummary(slug) {
  try {
    return git(slug, ['log', '--oneline', '-20']);
  } catch {
    return '';
  }
}
