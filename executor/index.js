import { execSync } from 'node:child_process';
import * as codex from '../agents/codex.adapter.js';
import * as claude from '../agents/claude.adapter.js';
import { config } from '../config.js';
import { AgentRun } from '../db/index.js';
import bus from '../dorch-bus.js';
import { workspacePath } from '../lib/paths.js';
import { appendRunLog, assembleContext } from '../memory/index.js';
import { Monitor } from '../monitor/monitor.js';

function parseUsage(text) {
  const cost = text.match(/total\s+cost[:\s]+\$?([\d.]+)/i)
    || text.match(/cost[:\s]+\$?([\d.]+)/i);
  const tokIn = text.match(/(\d[\d,]+)\s+input\s+tokens?/i)
    || text.match(/input\s+tokens?[:\s]+([\d,]+)/i)
    || text.match(/tokens\s+used[:\s]+([\d,]+)/i);
  const tokOut = text.match(/(\d[\d,]+)\s+output\s+tokens?/i)
    || text.match(/output\s+tokens?[:\s]+([\d,]+)/i);
  return {
    costUsd: cost ? parseFloat(cost[1]) : null,
    tokensIn: tokIn ? parseInt(tokIn[1].replace(/,/g, ''), 10) : null,
    tokensOut: tokOut ? parseInt(tokOut[1].replace(/,/g, ''), 10) : null
  };
}

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

    const startedAt = new Date();
    const outputChunks = [];
    child.stdout?.on('data', (chunk) => outputChunks.push(chunk.toString()));
    child.stderr?.on('data', (chunk) => outputChunks.push(chunk.toString()));

    this.current = { adapterName, adapter, startedAt, outputChunks, ...child };
    this.monitor.attach(child);

    AgentRun.create({ projectSlug: this.slug, agentName: adapterName, startedAt })
      .catch((e) => console.error('AgentRun create:', e));

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

    const stoppedAt = new Date();
    const durationMs = stoppedAt - stopped.startedAt;
    const usage = parseUsage(stopped.outputChunks.join(''));

    AgentRun.findOneAndUpdate(
      { projectSlug: this.slug, agentName: stopped.adapterName, stoppedAt: null },
      { stoppedAt, durationMs, ...usage },
      { sort: { startedAt: -1 } }
    ).catch((e) => console.error('AgentRun update:', e));

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
