import bus from '../dorch-bus.js';
import { BLOCKED, CONTEXT_FULL, MAX_RUNTIME_MS, NO_OUTPUT_TIMEOUT_MS, RATE_LIMIT, STEP_COMPLETE } from './triggers.js';

export class Monitor {
  constructor({ slug }) {
    this.slug = slug;
    this.switching = false;
    this.lastOutputAt = 0;
    this.agentStartedAt = 0;
    this.lastOutputBuffer = [];
    this.timer = null;
  }

  attach({ stdout, stderr, process }) {
    this.agentStartedAt = Date.now();
    this.lastOutputAt = Date.now();
    this.switching = false;
    this.timer = setInterval(() => this.checkTimeouts(), 30000);
    stdout?.on('data', (chunk) => this.handleChunk('stdout', chunk));
    stderr?.on('data', (chunk) => this.handleChunk('stderr', chunk));
    process.once('close', (code, signal) => {
      clearInterval(this.timer);
      if (this.switching) return;
      if (code !== 0) this.emitTrigger('process_error', `exit code ${code}`);
      else if (signal) this.emitTrigger('process_error', `signal ${signal}`);
    });
  }

  stop() {
    clearInterval(this.timer);
    this.switching = true;
  }

  handleChunk(source, chunk) {
    const text = chunk.toString();
    this.lastOutputAt = Date.now();
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      this.lastOutputBuffer.push(line);
      this.lastOutputBuffer = this.lastOutputBuffer.slice(-20);
      bus.emit('log:line', { slug: this.slug, source, text: line, ts: Date.now() });
    }
    if (this.switching) return;
    if (CONTEXT_FULL.test(text)) this.emitTrigger('process_error', text);
    else if (BLOCKED.test(text)) this.emitTrigger('blocked', text.match(BLOCKED)?.[1] || text);
    else if (RATE_LIMIT.test(text)) this.emitTrigger('rate_limit', text);
    else if (STEP_COMPLETE.test(text)) bus.emit('step:signal', { slug: this.slug });
  }

  checkTimeouts() {
    if (this.switching) return;
    const now = Date.now();
    if (now - this.lastOutputAt > NO_OUTPUT_TIMEOUT_MS) {
      this.emitTrigger('no_output_timeout', `${NO_OUTPUT_TIMEOUT_MS}ms with no output`);
    } else if (now - this.agentStartedAt > MAX_RUNTIME_MS) {
      this.emitTrigger('max_runtime', `${MAX_RUNTIME_MS}ms max runtime exceeded`);
    }
  }

  emitTrigger(type, raw) {
    if (this.switching) return;
    this.switching = true;
    bus.emit('trigger', { slug: this.slug, type, raw });
  }
}
