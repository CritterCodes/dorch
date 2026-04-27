import { config, validateConfig } from './config.js';
import bus from './dorch-bus.js';
import { connectDb } from './db/index.js';
import { createServer } from './server/index.js';
import { initExistingProjects } from './memory/index.js';
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

  const { app } = createServer({ bus });
  app.listen(config.port, () => {
    console.log(`dorch listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
