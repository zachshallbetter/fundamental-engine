// Headless smoke test: boot the built example and assert a live field with particles.
// Run with the repo's installed @playwright/test chromium.
import { chromium } from '@playwright/test';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'load' });

// Wait for the field layer to boot and the engine to seed its swarm.
const count = await page.waitForFunction(
  () => {
    const n = window.__fieldLayer?.particleCount?.();
    return typeof n === 'number' && n > 0 ? n : false;
  },
  { timeout: 10000 },
).then((h) => h.jsonValue());

await browser.close();

if (errors.length) {
  console.error('PAGE ERRORS:', errors.join('\n'));
  process.exit(1);
}
console.log(`SMOKE PASS particleCount=${count}`);
