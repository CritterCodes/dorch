import mongoose from 'mongoose';
import { AgentRun } from './models/agent-run.js';
import { Project } from './models/project.js';
import { Sprint } from './models/sprint.js';
import { PlannerMessage } from './models/planner-message.js';

export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export { mongoose, AgentRun, Project, Sprint, PlannerMessage };
