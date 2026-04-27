import { config } from '../config.js';
import bus from '../dorch-bus.js';
import { Executor } from '../executor/index.js';
import { writeHandoff } from '../handoff/handoff-manager.js';
import { appendRunLog } from '../memory/index.js';

export class SwitchController {
  constructor(slug) {
    this.slug = slug;
    this.state = 'IDLE';
    this.agentIndex = Math.max(0, config.agents.indexOf(config.primaryAgent));
    this.executor = new Executor(slug);
    this.switches = 0;
    this.bind();
  }

  bind() {
    bus.on('sprint:approved', ({ slug }) => {
      if (slug === this.slug) this.start();
    });
    bus.on('trigger', (trigger) => {
      if (trigger.slug === this.slug) this.handleTrigger(trigger);
    });
    bus.on('agent:stop_requested', ({ slug }) => {
      if (slug === this.slug) this.stop();
    });
    bus.on('step:signal', ({ slug }) => {
      if (slug === this.slug) this.handleStepSignal();
    });
  }

  start() {
    if (this.state !== 'IDLE') return;
    this.state = 'RUNNING';
    this.executor.startAgent(config.agents[this.agentIndex]);
  }

  async stop() {
    await this.executor.stopAgent();
    this.state = 'IDLE';
  }

  nextAgent() {
    this.agentIndex = (this.agentIndex + 1) % config.agents.length;
    return config.agents[this.agentIndex];
  }

  async handleTrigger(trigger) {
    if (this.state !== 'RUNNING') return;
    this.state = 'SWITCHING';
    this.switches += 1;
    appendRunLog(this.slug, 'trigger:received', trigger.type);
    const stopped = await this.executor.stopAgent();
    writeHandoff({
      slug: this.slug,
      fromAdapter: stopped?.adapterName || config.agents[this.agentIndex],
      switchReason: trigger.type,
      raw: trigger.raw,
      lastOutputBuffer: this.executor.monitor.lastOutputBuffer
    });
    if (this.switches >= config.maxSwitchesPerTask) {
      this.state = 'AWAITING_USER_INPUT';
      appendRunLog(this.slug, 'switch:paused', 'max switches reached');
      return;
    }
    const next = this.nextAgent();
    this.executor.startAgent(next);
    appendRunLog(this.slug, 'switch:complete', next);
    this.state = 'RUNNING';
  }

  handleStepSignal() {
    try {
      this.executor.runTests();
      appendRunLog(this.slug, 'step:complete');
      this.switches = 0;
      bus.emit('step:complete', { slug: this.slug });
    } catch {
      appendRunLog(this.slug, 'warn:tests_failed', 'step_complete_signal_ignored');
    }
  }
}
