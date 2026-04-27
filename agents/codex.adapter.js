import { spawn } from 'node:child_process';
import { workspacePath } from '../lib/paths.js';
import { executorPrompt, stopProcess } from './shared.js';

export function formatContext(context) {
  return executorPrompt(context);
}

export function start(context) {
  const formatted = formatContext(context);
  const proc = spawn('codex', ['--prompt', formatted], {
    cwd: workspacePath(context.slug),
    env: { ...process.env },
    shell: false
  });
  return { process: proc, stdout: proc.stdout, stderr: proc.stderr };
}

export const stop = stopProcess;
