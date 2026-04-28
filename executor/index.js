import { execSync } from 'node:child_process';
import * as codex from '../agents/codex.adapter.js';
import * as claude from '../agents/claude.adapter.js';
import { config } from '../config.js';
import bus from '../dorch-bus.js';
import { workspacePath } from '../lib/paths.js';
import { appendRunLog, assembleContext } from '../memory/index.js';
import { Monitor } from '../monitor/monitor.js';

const adapters = new Map([
  ['codex-cli', codex],
  ['claude-cli', claude]
]);

export class Executor {
  constructor(slug) {
    this.slug = slug;
    this.current = null;
    this.monitor = new Monitor({ slug });
  }

  startAgent(adapterName) {
    const adapter = adapters.get(adapterName);
    if (!adapter) throw new Error(`unknown adapter: ${adapterName}`);
    const context = { slug: this.slug, ...assembleContext(this.slug) };
    const child = adapter.start(context);
    this.current = { adapterName, adapter, ...child };
    this.monitor.attach(child);
    appendRunLog(this.slug, 'agent:started', adapterName);
    bus.emit('agent:started', { slug: this.slug, adapter: adapterName, pid: child.process.pid });
    return child;
  }

  async stopAgent() {
    if (!this.current) return null;
    const stopped = this.current;
    this.current = null;
    this.monitor.stop();
    await stopped.adapter.stop(stopped.process, config.killTimeoutMs);
    appendRunLog(this.slug, 'agent:stopped', stopped.adapterName);
    bus.emit('agent:stopped', { slug: this.slug, adapter: stopped.adapterName });
    return stopped;
  }

  runTests() {
    if (!config.testCommand) return;
    execSync(config.testCommand, {
      cwd: workspacePath(this.slug),
      stdio: 'inherit',
      shell: true
    });
  }
}
