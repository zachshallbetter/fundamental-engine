// Headless smoke test: serve the built dist/ and assert a live field booted.
// Proves the published @fundamental-engine/three package creates a real field layer.
// Resolve Playwright from PLAYWRIGHT_PKG if set (lets CI / the monorepo point at
// its own @playwright/test install); otherwise use the bare specifier.
const playwrightEntry = process.env.PLAYWRIGHT_PKG || '@playwright/test';
const { chromium } = await import(playwrightEntry);
import { preview } from 'vite';

const server = await preview({ preview: { port: 4320 } });
const url = `http://localhost:4320`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });

// main.js exposes `window.__fieldLayer` — poll particleCount() until > 0.
const count = await page.waitForFunction(
  () => {
    const n = window.__fieldLayer?.particleCount?.();
    return typeof n === 'number' && n > 0 ? n : false;
  },
  { timeout: 10000 },
).then((h) => h.jsonValue());

await browser.close();
await server.httpServer.close();

if (errors.length) {
  console.error('PAGE ERRORS:', errors.join('\n'));
  process.exit(1);
}
console.log(`SMOKE PASS particleCount=${count}`);
process.exit(0);
