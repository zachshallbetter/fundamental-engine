// Headless smoke test: serve the static dist/ output and assert a live field booted.
// Proves the published @fundamental-engine/vanilla package works in an Astro static build.
// astro.config.mjs sets output: 'static', so the output is plain HTML/CSS/JS in dist/.
// Resolve Playwright from PLAYWRIGHT_PKG if set (lets CI point at its own @playwright/test
// install); otherwise use the bare specifier (installed by the CI smoke step).
const playwrightEntry = process.env.PLAYWRIGHT_PKG || '@playwright/test';
const { chromium } = await import(playwrightEntry);
import { preview } from 'vite';

// Astro static output lands in dist/ — same default as Vite, so no outDir override needed.
const server = await preview({ preview: { port: 4321 } });
const url = `http://localhost:4321`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });

// index.astro's inline <script> assigns createField() result to globalThis.field.
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
