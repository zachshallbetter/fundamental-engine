/**
 * Long-frame + memory observer — fact sheet §3b
 *
 * Observes `PerformanceObserver(long-animation-frame)` entries and samples
 * `performance.memory.usedJSHeapSize` over a ~10-second active window to check
 * for long frames and heap growth (leak signal).
 *
 * Reports:
 *   • long-frame count and max duration (frames ≥ 50 ms per LoAF spec)
 *   • total blocking time (sum of (duration − 50) for each LoAF entry)
 *   • heap delta between start and end of the window
 *   • per-entry breakdown of any long frames found
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 * 1. Open the Fundamental page you want to measure in Chrome (v123+ for LoAF).
 * 2. Optionally start a scroll interaction so the reading-field path is active.
 * 3. Open DevTools → Console, paste this script, press Enter.
 * 4. The script runs for DURATION_MS (default 10 s), then prints the report.
 *    To run longer: call  `window.__longFrame.setDuration(30_000)` before pasting.
 *
 * Note: `performance.memory` is Chrome-only and approximate (GC affects readings).
 * LoAF entries require Chrome 123+ or equivalent Chromium-based browser.
 *
 * ── Output fields ──────────────────────────────────────────────────────────
 * duration_ms        — observation window length
 * long_frame_count   — frames that took ≥ 50 ms (LoAF threshold)
 * max_duration_ms    — longest single long frame
 * total_blocking_ms  — sum of (duration − 50) for each long frame
 * heap_start_mb      — JS heap at observation start (Chrome only)
 * heap_end_mb        — JS heap at observation end
 * heap_delta_mb      — growth (positive = potential leak signal)
 * heap_available     — false if running outside Chrome / memory API absent
 */

(function longFrameObserver() {
  // ── config ─────────────────────────────────────────────────────────────
  let DURATION_MS   = 10_000;   // observation window; override via window.__longFrame.setDuration()
  const LOAF_THRESHOLD = 50;    // ms — LoAF spec definition of a long animation frame

  // ── state ───────────────────────────────────────────────────────────────
  const longFrames  = [];
  const heapSamples = [];
  let observer      = null;
  let heapTimer     = null;
  let finishTimer   = null;
  let startTime     = null;

  const memApi = typeof performance !== 'undefined' && performance.memory;

  function sampleHeap() {
    if (!memApi) return;
    heapSamples.push({
      t:  performance.now(),
      mb: memApi.usedJSHeapSize / 1_048_576,
    });
  }

  // ── LoAF observer ───────────────────────────────────────────────────────
  if (!('PerformanceObserver' in window)) {
    console.warn('[long-frame] PerformanceObserver not available — cannot observe long frames.');
    return;
  }

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LOAF_THRESHOLD) {
          longFrames.push({
            start:    entry.startTime.toFixed(1),
            duration: entry.duration.toFixed(1),
            blocking: Math.max(0, entry.duration - LOAF_THRESHOLD).toFixed(1),
            scripts:  entry.scripts?.length ?? 0,
          });
        }
      }
    });
    observer.observe({ type: 'long-animation-frame', buffered: true });
  } catch (e) {
    console.warn('[long-frame] long-animation-frame not supported in this browser:', e.message);
    return;
  }

  // ── heap sampling (250 ms interval) ─────────────────────────────────────
  sampleHeap();
  startTime   = performance.now();
  heapTimer   = setInterval(sampleHeap, 250);

  console.log(`[long-frame] Observing for ${DURATION_MS / 1000} s… (scroll the page to exercise the reading-field path)`);

  // ── finish ────────────────────────────────────────────────────────────────
  function finish() {
    clearInterval(heapTimer);
    observer.disconnect();

    sampleHeap();  // final sample

    const elapsed  = performance.now() - startTime;
    const heapAvail = !!memApi;
    const heapStart = heapAvail ? heapSamples[0]?.mb ?? 0 : 0;
    const heapEnd   = heapAvail ? heapSamples[heapSamples.length - 1]?.mb ?? 0 : 0;
    const heapDelta = heapEnd - heapStart;

    const maxDuration = longFrames.length
      ? Math.max(...longFrames.map(f => parseFloat(f.duration)))
      : 0;
    const totalBlocking = longFrames.reduce((s, f) => s + parseFloat(f.blocking), 0);

    const summary = {
      duration_ms:       elapsed.toFixed(0),
      long_frame_count:  longFrames.length,
      max_duration_ms:   longFrames.length ? maxDuration.toFixed(1) : 'none',
      total_blocking_ms: totalBlocking.toFixed(1),
      heap_start_mb:     heapAvail ? heapStart.toFixed(2) : 'n/a',
      heap_end_mb:       heapAvail ? heapEnd.toFixed(2)   : 'n/a',
      heap_delta_mb:     heapAvail ? heapDelta.toFixed(2) : 'n/a',
      heap_available:    heapAvail,
    };

    console.log('\n── long-frame + memory report ─────────────────────────────────');
    console.table(summary);

    if (longFrames.length > 0) {
      console.log('\nLong frame breakdown:');
      console.table(longFrames);
    } else {
      console.log('✓ No long animation frames (≥50 ms) observed.');
    }

    if (heapAvail) {
      if (heapDelta > 5) {
        console.warn(`⚠ Heap grew by ${heapDelta.toFixed(2)} MB — may indicate a leak. Re-run with a longer window to confirm.`);
      } else {
        console.log(`✓ Heap delta ${heapDelta > 0 ? '+' : ''}${heapDelta.toFixed(2)} MB — no leak signal.`);
      }
    }

    console.log('\n[long-frame] Copy the summary object:');
    console.log(JSON.stringify({ ...summary, url: location.href, ua: navigator.userAgent }, null, 2));
  }

  finishTimer = setTimeout(finish, DURATION_MS);

  // ── public API ────────────────────────────────────────────────────────────
  window.__longFrame = {
    setDuration(ms) { DURATION_MS = ms; },
    cancel() {
      clearTimeout(finishTimer);
      clearInterval(heapTimer);
      observer.disconnect();
      console.log('[long-frame] cancelled');
    },
    finishNow() {
      clearTimeout(finishTimer);
      finish();
    },
  };
})();
