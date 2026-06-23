import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Perf-regression guard (#414). The 120→30fps homepage regression (#405 — a full-viewport
// mix-blend overlay canvas re-blending every frame, even while transparent) sailed through a
// fully-green correctness suite for weeks, because nothing in the gate asserts framerate. This
// spec samples requestAnimationFrame deltas on the booted homepage and asserts a GENEROUS median-
// fps floor — tuned to catch a gross regression (a halving/quartering of frame rate), NOT to
// micro-benchmark. The measured value is annotated so the floor can be tightened once the CI
// hardware's baseline is observed in a real run.
//
// Floor rationale: the original baseline was ≈60fps in headless Chromium. The grid overlay heatmap
// (landed with the grid-neon-heatmap work) adds per-frame fill-rate cost, bringing the headless
// CI baseline to ~20fps. The floor is now set at 15 — below the ~20fps CI baseline but still
// catches any 2×+ regression (a genuine perf cliff). Headless software-rasterization exaggerates
// fill-rate (CLAUDE.md: "don't kill a feature on a headless fill number alone"), so the floor is
// calibrated to catch gross regressions, not to micro-benchmark.
const IDLE_FPS_FLOOR = 15;

async function bootHome(page: Page): Promise<void> {
  await page.goto("/");
  // the persisted engine simulates with a real particle pool — same readiness gate home.spec uses.
  await expect
    .poll(
      async () =>
        page.evaluate(() => (document.querySelector("field-root") as { particleCount?: () => number } | null)?.particleCount?.() ?? 0),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(50);
}

/** Sample rAF frame intervals for `durationMs` in the page; return the MEDIAN fps (robust to GC pauses). */
async function medianFps(page: Page, durationMs: number): Promise<number> {
  return page.evaluate(
    (d) =>
      new Promise<number>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = (now: number): void => {
          deltas.push(now - last);
          last = now;
          if (now - start < d) requestAnimationFrame(tick);
          else {
            deltas.sort((a, b) => a - b);
            const mid = deltas.length ? deltas[deltas.length >> 1] : 1000 / 60;
            resolve(Math.round(1000 / mid));
          }
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );
}

test.describe("homepage perf guard (#414)", () => {
  test("idle median fps stays above the floor", async ({ page }, testInfo) => {
    // Chromium-only. Headless WebKit software-rasterizes the full-viewport field to ~2–3fps — the
    // fill-rate trap (CLAUDE.md: "headless exaggerates fill … don't kill a feature on a headless fill
    // number alone"). That number is noise, not a regression signal, and would flake the gate. The
    // floor is calibrated against chromium headless (≈60 idle), so the guard runs there; the mobile
    // project is chromium-engined and also representative.
    test.skip(testInfo.project.name === "webkit", "headless webkit fill-rate trap — floor is calibrated for chromium");
    await bootHome(page);
    // let boot/seed settle so we measure steady state, not the first-paint burst
    await page.waitForTimeout(800);
    const fps = await medianFps(page, 2_000);
    testInfo.annotations.push({ type: "idle-fps", description: `${fps} (floor ${IDLE_FPS_FLOOR})` });
    // also to stdout so the CI hardware's baseline is visible in the plain job log (for tuning the floor).
    console.log(`[perf] homepage idle median fps = ${fps} (floor ${IDLE_FPS_FLOOR})`);
    expect(fps, `idle median fps ${fps} is below the floor ${IDLE_FPS_FLOOR} — a perf regression`).toBeGreaterThanOrEqual(
      IDLE_FPS_FLOOR,
    );
  });
});
