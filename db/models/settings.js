import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  agents: { type: [String], default: ['codex-cli', 'claude-cli'] },
  primaryAgent: { type: String, default: 'codex-cli' },
  noOutputTimeoutMs: { type: Number, default: 180000 },
  maxRuntimeMs: { type: Number, default: 2700000 },
  maxSwitchesPerTask: { type: Number, default: 6 },
  testCommand: { type: String, default: '' }
}, { timestamps: true });

export const Settings = mongoose.model('Settings', settingsSchema);
