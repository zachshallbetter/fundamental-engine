// Headless smoke test: serve the static build/ output and assert a live field booted.
// Proves the published @fundamental-engine/vanilla package works in a SvelteKit static build.
// The svelte.config.js uses adapter-static, so the output is plain HTML/CSS/JS in build/.
// Resolve Playwright from PLAYWRIGHT_PKG if set (lets CI point at its own @playwright/test
// install); otherwise use the bare specifier (installed by the CI smoke step).
const playwrightEntry = process.env.PLAYWRIGHT_PKG || '@playwright/test';
const { chromium } = await import(playwrightEntry);
import { preview } from 'vite';

// SvelteKit adapter-static writes to build/ — tell Vite's preview server to serve from there.
const server = await preview({
  build: { outDir: 'build' },
  preview: { port: 4322 },
});
const url = `http://localhost:4322`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });

// FieldCanvas.svelte assigns createField() result to globalThis.field via onMount().
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
