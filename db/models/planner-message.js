import mongoose from 'mongoose';

const plannerMessageSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  sprintN: { type: Number, required: true },
  from: { type: String, enum: ['user', 'planner'], required: true },
  text: { type: String, required: true },
  ts: { type: Date, default: Date.now }
});

plannerMessageSchema.index({ projectSlug: 1, sprintN: 1, ts: 1 });

export const PlannerMessage = mongoose.model('PlannerMessage', plannerMessageSchema);
