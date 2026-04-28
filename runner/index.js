import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { workspacePath } from '../lib/paths.js';

export class Runner extends EventEmitter {
  constructor(slug) {
    super();
    this.slug = slug;
    this.proc = null;
    this.state = 'IDLE';
    this.lines = [];
  }

  start(command, port) {
    if (this.state === 'RUNNING') return;
    this.lines = [];
    this.state = 'RUNNING';

    this.proc = spawn(command, [], {
      cwd: workspacePath(this.slug),
      env: { ...process.env, PORT: String(port), FORCE_COLOR: '0' },
      shell: true
    });

    const addLine = (source, text) => {
      const item = { source, text: text.trimEnd(), ts: new Date().toISOString() };
      this.lines = [...this.lines.slice(-500), item];
      this.emit('line', item);
    };

    this.proc.stdout.on('data', (d) =>
      d.toString().split('\n').filter(Boolean).forEach((l) => addLine('stdout', l))
    );
    this.proc.stderr.on('data', (d) =>
      d.toString().split('\n').filter(Boolean).forEach((l) => addLine('stderr', l))
    );
    this.proc.on('close', (code) => {
      this.state = 'IDLE';
      this.proc = null;
      addLine('system', `process exited (${code ?? 'null'})`);
    });
  }

  stop() {
    if (!this.proc || this.state !== 'RUNNING') return;
    this.proc.kill('SIGTERM');
  }
}
