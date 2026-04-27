import test from 'node:test';
import assert from 'node:assert/strict';
import { Executor } from '../executor/index.js';
import { initProject } from '../memory/index.js';
import bus from '../dorch-bus.js';

test('Copilot CLI agent lifecycle', async (t) => {
  const slug = `test-copilot-${Date.now()}`;
  initProject(slug);
  const executor = new Executor(slug);

  let startedEvent = null;
  let stoppedEvent = null;

  bus.on('agent:started', (e) => {
    if (e.slug === slug) startedEvent = e;
  });

  bus.on('agent:stopped', (e) => {
    if (e.slug === slug) stoppedEvent = e;
  });

  await t.test('starts copilot-cli', async () => {
    const child = executor.startAgent('copilot-cli');
    assert.ok(child.process.pid, 'Process should have a PID');
    assert.equal(startedEvent.adapter, 'copilot-cli');
  });

  await t.test('stops copilot-cli', async () => {
    await executor.stopAgent();
    assert.equal(stoppedEvent.adapter, 'copilot-cli');
  });
});
