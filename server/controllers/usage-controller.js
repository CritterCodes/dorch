import { AgentRun } from '../../db/index.js';

export async function getProjectUsage(req, res) {
  const { slug } = req.params;
  const runs = await AgentRun.find({ projectSlug: slug, stoppedAt: { $ne: null } }).lean();

  const byAgent = {};
  let totalCostUsd = 0;
  let totalDurationMs = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  for (const run of runs) {
    if (!byAgent[run.agentName]) {
      byAgent[run.agentName] = { runs: 0, durationMs: 0, costUsd: 0, tokensIn: 0, tokensOut: 0 };
    }
    const a = byAgent[run.agentName];
    a.runs += 1;
    a.durationMs += run.durationMs || 0;
    a.costUsd += run.costUsd || 0;
    a.tokensIn += run.tokensIn || 0;
    a.tokensOut += run.tokensOut || 0;
    totalDurationMs += run.durationMs || 0;
    totalCostUsd += run.costUsd || 0;
    totalTokensIn += run.tokensIn || 0;
    totalTokensOut += run.tokensOut || 0;
  }

  res.json({
    totalRuns: runs.length,
    totalDurationMs,
    totalCostUsd,
    totalTokensIn,
    totalTokensOut,
    byAgent
  });
}

export async function getGlobalUsage(req, res) {
  const runs = await AgentRun.find({ stoppedAt: { $ne: null } }).lean();

  const byProject = {};
  for (const run of runs) {
    if (!byProject[run.projectSlug]) {
      byProject[run.projectSlug] = { runs: 0, durationMs: 0, costUsd: 0 };
    }
    const p = byProject[run.projectSlug];
    p.runs += 1;
    p.durationMs += run.durationMs || 0;
    p.costUsd += run.costUsd || 0;
  }

  const totalCostUsd = Object.values(byProject).reduce((s, p) => s + p.costUsd, 0);
  res.json({ byProject, totalCostUsd });
}
