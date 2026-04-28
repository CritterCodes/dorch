import mongoose from 'mongoose';

const agentRunSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  sprintN: { type: Number, default: null },
  agentName: { type: String, required: true },
  stopReason: { type: String, default: null },
  startedAt: { type: Date, required: true },
  stoppedAt: { type: Date, default: null },
  durationMs: { type: Number, default: null },
  tokensIn: { type: Number, default: null },
  tokensOut: { type: Number, default: null },
  costUsd: { type: Number, default: null }
});

export const AgentRun = mongoose.model('AgentRun', agentRunSchema);
