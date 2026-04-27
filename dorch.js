import { config, validateConfig } from './config.js';
import bus from './dorch-bus.js';
import { connectDb } from './db/index.js';
import { createServer } from './server/index.js';
import { appendRunLog, getProjectSlugs, hasUncleanShutdown, initExistingProjects } from './memory/index.js';
import { SwitchController } from './switch-controller/index.js';

async function main() {
  validateConfig();
  await connectDb(config.mongoUri);
  initExistingProjects();
  const runtimes = new Map();
  const ensureRuntime = (slug) => {
    if (!runtimes.has(slug)) runtimes.set(slug, new SwitchController(slug));
    return runtimes.get(slug);
  };
  bus.on('runtime:ensure', ({ slug }) => ensureRuntime(slug));

  for (const slug of getProjectSlugs()) {
    if (hasUncleanShutdown(slug)) {
      const rt = ensureRuntime(slug);
      rt.markUncleanShutdown();
      appendRunLog(slug, 'recovery:detected', 'unclean shutdown — resume to continue');
    }
  }

  const { app } = createServer({ bus, runtimes });
  app.listen(config.port, () => {
    console.log(`dorch listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
