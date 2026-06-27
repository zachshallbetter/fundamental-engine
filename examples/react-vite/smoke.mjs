// Headless smoke test: serve the built dist/ and assert a live field booted.
// Proves the published @fundamental-engine/react package mounts a real field.
// Resolve Playwright from PLAYWRIGHT_PKG if set (lets CI / the monorepo point at
// its own @playwright/test install); otherwise use the bare specifier.
const playwrightEntry = process.env.PLAYWRIGHT_PKG || '@playwright/test';
const { chromium } = await import(playwrightEntry);
import { preview } from 'vite';

const server = await preview({ preview: { port: 4319 } });
const url = `http://localhost:4319`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });

// onReady stashes the FieldHandle on window.field; poll particleCount() until > 0.
const count = await page.waitForFunction(
  () => {
    const f = window.field;
    const n = f && typeof f.particleCount === 'function' ? f.particleCount() : 0;
    return n > 0 ? n : false;
  },
  { timeout: 10000 },
).then((h) => h.jsonValue());

await browser.close();
await server.httpServer.close();

if (errors.length) {
  console.error('Page errors:', errors.join('\n'));
  process.exit(1);
}

console.log(`SMOKE PASS: field booted, particleCount() = ${count}`);
process.exit(0);
