#!/usr/bin/env node
/**
 * The fill-rate sweep on real GPU hardware — RC-7's measured half.
 *
 * Drives a running Chrome (headless=new with GPU, launched by the caller with --remote-debugging-port)
 * over CDP: runs the /perf-bench page's render × dprCap × density sweep and its compositing sweep, then
 * measures three real pages for 20 s each — rAF frame deltas (median / p95 / p99), Long Animation
 * Frames ≥ 50 ms (count, max, Total Blocking Time), and the JS heap. Writes one JSON measurement file.
 *
 *   node scripts/perf/sweep-gpu.mjs --cdp http://127.0.0.1:9222 --site http://127.0.0.1:4399 --label titan-dpr1 --out perf/titan-dpr1.json
 *
 * Needs @playwright/test resolvable (run from apps/site, or with NODE_PATH=apps/site/node_modules). The
 * caller owns the Chrome flags — the fact sheet records the renderer string this script reads back.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((p) => p.length));
const CDP = args.cdp ?? 'http://127.0.0.1:9222';
const SITE = (args.site ?? 'http://127.0.0.1:4399').replace(/\/$/, '');
const LABEL = args.label ?? 'gpu';
const OUT = args.out ?? `perf/${LABEL}.json`;
const PAGES = (args.pages ?? '/,/eli5,/docs/patterns').split(',');
const SECONDS = Number(args.seconds ?? 20);

const require = createRequire(new URL('../../apps/site/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const result = { label: LABEL, measuredAt: new Date().toISOString(), site: SITE, ua: null, dpr: null, viewport: null, gpu: null, gpuFeatures: null, sweep: null, compositing: null, pages: {} };

await page.goto('about:blank');
result.gpu = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'no webgl';
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
try {
  const bcdp = await browser.newBrowserCDPSession();
  const info = await bcdp.send('SystemInfo.getInfo');
  result.gpuFeatures = info.gpu?.featureStatus ?? null;
  result.gpuDevices = (info.gpu?.devices ?? []).map((d) => d.deviceString || d.vendorString || `${d.vendorId}:${d.deviceId}`);
  await bcdp.detach();
} catch (e) {
  result.gpuFeatures = `unavailable: ${e.message}`;
}
// A software rasterizer (SwiftShader, llvmpipe) would silently invalidate every fill-rate number below:
// refuse to measure unless explicitly allowed (ALLOW_SOFTWARE=1), and record the verdict either way.
result.hardware = /NVIDIA|GeForce|Radeon|AMD|Intel|Apple|Adreno|Mali/i.test(result.gpu) && !/SwiftShader|llvmpipe|softpipe|Software/i.test(result.gpu);
if (!result.hardware && !process.env.ALLOW_SOFTWARE) {
  console.error(`sweep-gpu: WebGL renderer is "${result.gpu}" — not a hardware GPU; refusing to measure (set ALLOW_SOFTWARE=1 to override)`);
  await page.close();
  process.exit(3);
}

await page.goto(`${SITE}/perf-bench`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
result.ua = await page.evaluate(() => navigator.userAgent);
result.dpr = await page.evaluate(() => devicePixelRatio);
result.viewport = await page.evaluate(() => `${innerWidth}x${innerHeight}`);
const rows = (nth) => page.evaluate((i) => {
  const t = document.querySelectorAll('table')[i];
  return t ? [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())) : [];
}, nth);
const status = () => page.evaluate(() => document.getElementById('status')?.textContent || '');
const waitFor = async (re) => { for (let i = 0; i < 300; i++) { await page.waitForTimeout(2000); const s = await status(); if (re.test(s)) return s; } return await status(); };

await page.click('#run');
result.sweepStatus = await waitFor(/^Done/);
result.sweep = (await rows(0)).map(([render, dprCap, density, particles, fpsMed, fpsP5, msMed]) => ({ render, dprCap: +dprCap, density: +density, particles: +particles, fpsMed: +fpsMed, fpsP5: +fpsP5, msMed: +msMed }));
await page.click('#run-comp');
result.compositingStatus = await waitFor(/^Compositing done/);
result.compositing = (await rows(1)).map(([overlay, dprCap, particles, fpsMed, fpsP5, msMed]) => ({ overlay, dprCap: +dprCap, particles: +particles, fpsMed: +fpsMed, fpsP5: +fpsP5, msMed: +msMed }));

for (const path of PAGES) {
  const p = await ctx.newPage();
  await p.goto(SITE + path, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  result.pages[path] = await p.evaluate((seconds) => new Promise((resolve) => {
    const deltas = []; const loaf = []; let tbt = 0; let last = performance.now();
    let po = null;
    const observe = (type) => { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration >= 50) { loaf.push(e.duration); tbt += e.duration - 50; } }); po.observe({ type, buffered: false }); };
    try { observe('long-animation-frame'); } catch { try { observe('longtask'); } catch { po = null; } }
    const heap0 = performance.memory ? performance.memory.usedJSHeapSize : null;
    const t0 = performance.now();
    const tick = (now) => { deltas.push(now - last); last = now; if (now - t0 < seconds * 1000) requestAnimationFrame(tick); else done(); };
    const done = () => {
      po && po.disconnect();
      const s = [...deltas].sort((a, b) => a - b); const pct = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
      resolve({ seconds, frames: deltas.length, msMed: pct(0.5), msP95: pct(0.95), msP99: pct(0.99), fpsMed: 1000 / pct(0.5), dropped: deltas.filter((d) => d > 25).length, loafCount: loaf.length, loafMaxMs: loaf.length ? Math.max(...loaf) : 0, tbtMs: tbt, heapStartMB: heap0 == null ? null : heap0 / 1048576, heapEndMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, particles: document.querySelector('field-root')?.handle?.particleCount?.() ?? null });
    };
    requestAnimationFrame(tick);
  }), SECONDS);
  await p.close();
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`${LABEL}: ${result.sweep.length} sweep rows, ${result.compositing.length} compositing rows, ${Object.keys(result.pages).length} pages → ${OUT}\n  gpu: ${result.gpu}\n  dpr ${result.dpr} · ${result.viewport}`);
await page.close();
await browser.close();
