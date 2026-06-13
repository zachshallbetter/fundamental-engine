/**
 * Headroom probe — fact sheet §3a
 *
 * Injects a calibrated busy-spin into every animation frame and sweeps the spin
 * duration upward until the page can no longer hold its native refresh rate.
 * The largest spin that still holds gives:
 *
 *     W ≈ budget − S_max   (per-frame compute cost of field-ui)
 *     headroom ≈ budget − W − S_max  (free budget remaining)
 *
 * where `budget` is the inverse of the display refresh rate (8.33 ms at 120 Hz,
 * 16.67 ms at 60 Hz). This converts "zero dropped frames" into a concrete number.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 * 1. Open the field-ui page you want to measure in Chrome.
 * 2. Open DevTools → Console.
 * 3. Paste this entire script and press Enter.
 * 4. The probe runs for ~90 seconds, printing a live table as each spin level
 *    completes. When done it prints the final result block to the console.
 *
 * Alternatively run it via puppeteer:
 *   node scripts/perf/run-headroom.mjs --url https://fundamental-engine.com
 *
 * ── How it works ───────────────────────────────────────────────────────────
 * Each "level" runs for FRAMES_PER_LEVEL animation frames. The probe inserts a
 * synchronous busy-loop of exactly SPIN ms at the start of every rAF callback.
 * If the observed frame duration stays ≤ budget × TOLERANCE the level passes;
 * if more than MISS_THRESHOLD % of frames exceed the budget the level fails.
 * The probe binary-searches over spin values from MIN_SPIN to MAX_SPIN ms.
 *
 * The busy-spin uses a tight Date.now() loop (not setTimeout) so it occupies
 * the main thread exactly — the same thread field-ui runs on.
 *
 * ── Output fields ──────────────────────────────────────────────────────────
 * budget_ms      — detected refresh interval (1000 / fps)
 * spin_ms        — the spin injected at this level
 * median_ms      — median observed frame duration
 * p95_ms         — 95th-percentile frame duration
 * miss_pct       — % of frames that exceeded budget × TOLERANCE
 * passed         — whether this level held the refresh rate
 * W_estimate_ms  — estimated per-frame compute (budget − S_max_passed)
 * headroom_pct   — free budget as a percentage (W / budget × 100)
 */

(function headroomProbe() {
  // ── config ─────────────────────────────────────────────────────────────
  const FRAMES_PER_LEVEL = 180;     // ~1.5 s at 120 Hz, ~3 s at 60 Hz
  const MIN_SPIN         = 0;       // ms — start with no spin (baseline)
  const MAX_SPIN         = 10;      // ms — stop here; >10 ms always drops frames
  const SPIN_STEP        = 0.5;     // ms — sweep step
  const MISS_THRESHOLD   = 0.02;    // 2 % miss rate = level fails
  const TOLERANCE        = 1.15;    // frame may exceed budget by 15 % before counting as miss

  // ── state ───────────────────────────────────────────────────────────────
  const levels = [];
  for (let s = MIN_SPIN; s <= MAX_SPIN + 1e-9; s = Math.round((s + SPIN_STEP) * 100) / 100) {
    levels.push(s);
  }

  let levelIndex  = 0;
  let frameCount  = 0;
  let budget      = null;   // detected from first 60 baseline frames
  let lastTime    = null;
  let deltas      = [];
  let rafHandle   = null;
  let spinning    = false;

  const results   = [];

  // ── busy-spin ────────────────────────────────────────────────────────────
  function busySpin(ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) { /* intentional busy wait */ }
  }

  // ── percentile helper ────────────────────────────────────────────────────
  function pct(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const i = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[i];
  }

  // ── main rAF loop ─────────────────────────────────────────────────────────
  function frame(now) {
    const spin = levels[levelIndex] ?? 0;
    if (spin > 0) busySpin(spin);

    if (lastTime !== null) {
      const delta = now - lastTime;
      deltas.push(delta);
    }
    lastTime = now;
    frameCount++;

    // Detect budget from the first level's first 60 clean frames (spin = 0)
    if (budget === null && levelIndex === 0 && deltas.length === 60) {
      budget = pct(deltas, 50);
      console.log(`[headroom] Detected refresh interval: ${budget.toFixed(2)} ms (${(1000 / budget).toFixed(0)} Hz)`);
      console.log('[headroom] Starting sweep…\n');
    }

    if (frameCount >= FRAMES_PER_LEVEL && budget !== null) {
      const missCount = deltas.filter(d => d > budget * TOLERANCE).length;
      const missPct   = missCount / deltas.length;
      const passed    = missPct <= MISS_THRESHOLD;
      const result = {
        spin_ms:  spin,
        median_ms: pct(deltas, 50).toFixed(2),
        p95_ms:    pct(deltas, 95).toFixed(2),
        miss_pct:  (missPct * 100).toFixed(1),
        passed,
      };
      results.push(result);
      console.log(
        `spin ${String(spin.toFixed(1)).padStart(4)} ms  |  ` +
        `median ${result.median_ms.padStart(6)}  p95 ${result.p95_ms.padStart(6)}  |  ` +
        `miss ${result.miss_pct.padStart(5)} %  |  ${passed ? '✓ pass' : '✗ FAIL'}`
      );

      levelIndex++;
      frameCount = 0;
      deltas     = [];

      if (levelIndex >= levels.length) {
        finish();
        return;
      }
    }

    rafHandle = requestAnimationFrame(frame);
  }

  // ── finish ────────────────────────────────────────────────────────────────
  function finish() {
    cancelAnimationFrame(rafHandle);

    const passed     = results.filter(r => r.passed);
    const failed     = results.filter(r => !r.passed);
    const S_max      = passed.length ? Math.max(...passed.map(r => r.spin_ms)) : 0;
    const W_estimate = Math.max(0, budget - S_max).toFixed(2);
    const headroomPct = ((S_max / budget) * 100).toFixed(1);

    const summary = {
      budget_ms:     budget.toFixed(2),
      S_max_passed_ms: S_max.toFixed(1),
      W_estimate_ms: W_estimate,
      headroom_pct:  headroomPct,
      first_failing_spin_ms: failed.length ? failed[0].spin_ms.toFixed(1) : 'none (all passed)',
      levels_run:   results.length,
    };

    console.log('\n── headroom-probe result ──────────────────────────────────────');
    console.table(summary);
    console.log(
      `\nInterpretation: field-ui uses ~${W_estimate} ms/frame on the main thread ` +
      `(${(100 - parseFloat(headroomPct)).toFixed(1)} % of the ${budget.toFixed(2)}-ms budget). ` +
      `${headroomPct} % headroom remaining.`
    );
    console.log('\nFull results:');
    console.table(results);
    console.log('\n[headroom] Copy the summary object:');
    console.log(JSON.stringify({ ...summary, url: location.href, ua: navigator.userAgent }, null, 2));
  }

  // ── start ─────────────────────────────────────────────────────────────────
  console.log('[headroom] Starting baseline (no spin for first level)…');
  rafHandle = requestAnimationFrame(frame);

  // expose cancel handle
  window.__headroomProbe = { cancel() { cancelAnimationFrame(rafHandle); console.log('[headroom] cancelled'); } };
})();
