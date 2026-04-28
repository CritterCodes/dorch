import { applySettings, config, validateConfig } from './config.js';
import bus from './dorch-bus.js';
import { connectDb, Settings } from './db/index.js';
import { createServer } from './server/index.js';
import { appendRunLog, getProjectSlugs, hasUncleanShutdown, initExistingProjects } from './memory/index.js';
import { Runner } from './runner/index.js';
import { SwitchController } from './switch-controller/index.js';

async function main() {
  validateConfig();
  await connectDb(config.mongoUri);

  const storedSettings = await Settings.findOne({}).lean();
  if (storedSettings) applySettings(storedSettings);

  initExistingProjects();
  const runtimes = new Map();
  const ensureRuntime = (slug) => {
    if (!runtimes.has(slug)) runtimes.set(slug, new SwitchController(slug));
    return runtimes.get(slug);
  };
  bus.on('runtime:ensure', ({ slug }) => ensureRuntime(slug));

  const runners = new Map();
  bus.on('runner:ensure', ({ slug }) => {
    if (!runners.has(slug)) runners.set(slug, new Runner(slug));
  });

  for (const slug of getProjectSlugs()) {
    if (hasUncleanShutdown(slug)) {
      const rt = ensureRuntime(slug);
      rt.markUncleanShutdown();
      appendRunLog(slug, 'recovery:detected', 'unclean shutdown — resume to continue');
    }
  }

  const { app } = createServer({ bus, runtimes, runners });
  app.listen(config.port, () => {
    console.log(`dorch listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
