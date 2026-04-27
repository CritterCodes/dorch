import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assembleContext, initProject, writeLatestHandoff } from '../memory/index.js';
import { memoryPath, plannerPath, workspacePath } from '../lib/paths.js';

test('initProject creates the runtime folder contract', () => {
  const slug = `test-${Date.now()}`;
  initProject(slug);

  assert.ok(fs.existsSync(workspacePath(slug)));
  assert.ok(fs.existsSync(path.join(memoryPath(slug), 'project-brief.md')));
  assert.ok(fs.existsSync(path.join(memoryPath(slug), 'sprints')));
  assert.ok(fs.existsSync(path.join(plannerPath(slug), 'current-conversation.jsonl')));
});

test('assembleContext returns first-run marker and trims latest handoff', () => {
  const slug = `test-${Date.now()}-trim`;
  initProject(slug);
  writeLatestHandoff(slug, `# Handoff\nNo prior handoff.\n${'x'.repeat(6000)}`);

  const context = assembleContext(slug);
  assert.equal(context.isFirstRun, true);
  assert.ok(context.latestHandoff.length <= 4800);
});
