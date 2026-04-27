import bus from '../dorch-bus.js';
import { diffStat } from '../lib/git.js';
import { appendHandoffHistory, readCurrentTask, writeLatestHandoff } from '../memory/index.js';

const reasonMap = new Map([
  ['rate_limit', 'rate_limit'],
  ['no_output_timeout', 'timeout'],
  ['max_runtime', 'timeout'],
  ['process_error', 'error'],
  ['blocked', 'error'],
  ['manual', 'manual'],
  ['complete', 'complete']
]);

function agentName(adapter = '') {
  return adapter.includes('claude') ? 'claude' : 'codex';
}

export function buildHandoff({ slug, fromAdapter, switchReason, lastOutputBuffer = [], raw = '' }) {
  const task = readCurrentTask(slug).split(/\r?\n/).find((line) => line.trim()) || 'Unknown task';
  const stat = diffStat(slug) || 'no uncommitted diff';
  const lastOutput = lastOutputBuffer.slice(-10);
  while (lastOutput.length < 5) lastOutput.unshift('no output');
  return `## Handoff
Agent: ${agentName(fromAdapter)}
Reason: ${reasonMap.get(switchReason) || 'error'}
Task: ${task}
Date: ${new Date().toISOString()}

### Completed
- none

### In Progress
- ${stat}

### Files Changed
- ${stat}

### Issues / Blockers
- ${raw || 'none'}

### Last Output
${lastOutput.join('\n')}

### Next Step
Continue from the current task, inspect the diff, and run the configured tests before signaling completion.
`;
}

export function writeHandoff(runState) {
  const handoff = buildHandoff(runState);
  writeLatestHandoff(runState.slug, handoff);
  appendHandoffHistory(runState.slug, handoff);
  bus.emit('handoff:written', { slug: runState.slug, path: `projects/${runState.slug}/memory/latest-handoff.md` });
  return handoff;
}
