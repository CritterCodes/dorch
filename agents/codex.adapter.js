import { spawn } from 'node:child_process';
import { workspacePath } from '../lib/paths.js';
import { commandName, executorPrompt, stopProcess } from './shared.js';

export function formatContext(context) {
  return executorPrompt(context);
}

export function start(context) {
  const formatted = formatContext(context);
  const proc = spawn(commandName('codex'), [
    'exec',
    '--full-auto',
    '--cd',
    workspacePath(context.slug),
    '-'
  ], {
    cwd: workspacePath(context.slug),
    env: { ...process.env },
    shell: false
  });
  proc.stdin.end(formatted);
  return { process: proc, stdout: proc.stdout, stderr: proc.stderr };
}

export const stop = stopProcess;
