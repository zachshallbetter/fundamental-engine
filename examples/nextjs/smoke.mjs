// Headless smoke test: serve the static out/ export and assert a live field booted.
// Proves the published @fundamental-engine/vanilla package works in a Next.js static export.
// next.config.mjs sets output: 'export', so next build writes plain HTML/CSS/JS to out/.
// Resolve Playwright from PLAYWRIGHT_PKG if set (lets CI point at its own @playwright/test
// install); otherwise use the bare specifier (installed by the CI smoke step).
const playwrightEntry = process.env.PLAYWRIGHT_PKG || '@playwright/test';
const { chromium } = await import(playwrightEntry);
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

const PORT = 3001;
const ROOT = join(process.cwd(), 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
};

// Minimal SPA-compatible static file server.
const httpServer = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let filePath = join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!existsSync(filePath) || (await import('fs')).statSync(filePath).isDirectory()) {
    filePath = join(ROOT, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    const mime = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => httpServer.listen(PORT, resolve));
const url = `http://localhost:${PORT}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });

// FieldCanvas.tsx (a 'use client' component) assigns createField() result to window.field.
const count = await page.waitForFunction(
  () => {
    const f = window.field;
    const n = f && typeof f.particleCount === 'function' ? f.particleCount() : 0;
    return n > 0 ? n : false;
  },
  { timeout: 15000 },
).then((h) => h.jsonValue());

await browser.close();
httpServer.close();

if (errors.length) {
  console.error('Page errors:', errors.join('\n'));
  process.exit(1);
}

console.log(`SMOKE PASS: field booted, particleCount() = ${count}`);
process.exit(0);
