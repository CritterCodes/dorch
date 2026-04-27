import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  repoUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null }
});

export const Project = mongoose.model('Project', projectSchema);
