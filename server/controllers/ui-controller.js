import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';

export function favicon(_req, res) {
  res.status(204).end();
}

export function chromeDevToolsProbe(_req, res) {
  res.status(204).end();
}

export function appShell(_req, res) {
  const indexPath = path.join(config.rootDir, 'server', 'ui', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
    return;
  }

  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dorch</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0f0e;
        --panel: #111513;
        --border: #242825;
        --fg: #d6d4ce;
        --muted: #8a8d88;
        --green: oklch(0.72 0.18 145);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--bg);
        color: var(--fg);
        font-family: Inter, system-ui, sans-serif;
      }
      main {
        width: min(480px, calc(100vw - 32px));
        border: 1px solid var(--border);
        background: var(--panel);
        padding: 24px;
        border-radius: 8px;
      }
      h1 {
        margin: 0 0 8px;
        font: 600 18px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
        color: var(--green);
      }
      p {
        margin: 0 0 16px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }
      code {
        color: var(--fg);
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>dorch</h1>
      <p>The backend is running. The production Vite UI has not been built yet.</p>
      <p>Use <code>POST /auth/login</code> and authenticated <code>/projects</code> API routes for now.</p>
    </main>
  </body>
</html>`);
}
