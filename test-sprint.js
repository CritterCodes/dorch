import { Project, Sprint } from './db/index.js';
import mongoose from 'mongoose';
import { config } from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import { initWorkspace } from './lib/git.js';
import { initProject } from './memory/index.js';
import { createSprint } from './server/services/sprint-service.js';

async function runTest() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    const testSlug = 'test-project-' + Date.now();
    
    // Initialize project (creates directories and files)
    initProject(testSlug);
    console.log('Initialized project directory:', testSlug);

    // Initialize git repo
    initWorkspace(testSlug);
    console.log('Initialized workspace:', testSlug);

    await Project.create({ slug: testSlug, name: 'Test Project' });
    console.log('Created project in DB');

    // MOCK planner.startSprint because it likely makes API calls or needs keys
    // We'll mock it if we can, but let's see if it fails first
    
    const result = await createSprint(testSlug, { goal: 'Test Goal' });
    console.log('Sprint created:', result.sprint.n);
    console.log('Branch created:', result.sprint.branch);
    
    // Verify file update
    const memoryDir = path.join(config.projectsDir, testSlug, 'memory');
    const sprintFilePath = path.join(memoryDir, 'current-sprint.md');
    if (fs.existsSync(sprintFilePath)) {
      console.log('Sprint file exists at', sprintFilePath);
      const content = fs.readFileSync(sprintFilePath, 'utf8');
      console.log('File content preview:', content.split('\n')[0]);
      if (content.includes('Test Goal')) {
        console.log('Goal found in sprint file');
      }
    } else {
      console.log('Sprint file NOT found at', sprintFilePath);
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTest();
