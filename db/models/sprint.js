import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  n: { type: Number, required: true },
  goal: { type: String, required: true },
  status: {
    type: String,
    enum: ['PLANNED', 'ACTIVE', 'REVIEW', 'CLOSED'],
    default: 'PLANNED'
  },
  branch: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
});

sprintSchema.index({ projectSlug: 1, n: 1 }, { unique: true });

export const Sprint = mongoose.model('Sprint', sprintSchema);
