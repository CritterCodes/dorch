import { applySettings, config } from '../../config.js';
import { Settings } from '../../db/index.js';

const AVAILABLE_AGENTS = ['codex-cli', 'claude-cli'];

export async function getSettings(req, res) {
  const stored = await Settings.findOne({}).lean();
  res.json({
    availableAgents: AVAILABLE_AGENTS,
    agents: stored?.agents ?? config.agents,
    primaryAgent: stored?.primaryAgent ?? config.primaryAgent,
    noOutputTimeoutMs: stored?.noOutputTimeoutMs ?? config.noOutputTimeoutMs,
    maxRuntimeMs: stored?.maxRuntimeMs ?? config.maxRuntimeMs,
    maxSwitchesPerTask: stored?.maxSwitchesPerTask ?? config.maxSwitchesPerTask,
    testCommand: stored?.testCommand ?? config.testCommand
  });
}

export async function updateSettings(req, res) {
  const { agents, primaryAgent, noOutputTimeoutMs, maxRuntimeMs, maxSwitchesPerTask, testCommand } = req.body;

  const update = {};
  if (Array.isArray(agents) && agents.length > 0) update.agents = agents.filter((a) => AVAILABLE_AGENTS.includes(a));
  if (primaryAgent && AVAILABLE_AGENTS.includes(primaryAgent)) update.primaryAgent = primaryAgent;
  if (Number.isFinite(noOutputTimeoutMs) && noOutputTimeoutMs >= 30000) update.noOutputTimeoutMs = noOutputTimeoutMs;
  if (Number.isFinite(maxRuntimeMs) && maxRuntimeMs >= 60000) update.maxRuntimeMs = maxRuntimeMs;
  if (Number.isFinite(maxSwitchesPerTask) && maxSwitchesPerTask >= 1) update.maxSwitchesPerTask = maxSwitchesPerTask;
  if (testCommand !== undefined) update.testCommand = String(testCommand);

  await Settings.updateOne({}, update, { upsert: true });
  applySettings(update);

  res.json({ ok: true, applied: update });
}
