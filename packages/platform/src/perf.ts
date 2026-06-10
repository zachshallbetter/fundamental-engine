/**
 * FieldPerf — the frame-duration split of the performance-budget story: pure timing math
 * lifted from the site's DataConsole prototype (which had been running these exact rules in
 * production). Core's `inspectBudget`/`DEFAULT_BUDGET` judge a *configuration*; the
 * QualityGovernor turns sustained overruns into a degradation *tier*; FieldPerf is the
 * *measurement* — feed it rAF timestamps, read back fps / budget / percentiles / dropped.
 *
 * The lifted rules (byte-compatible with the DataConsole, so its conversion is
 * behavior-identical):
 *   - deltas: consecutive `feed(ts)` differences, kept in a rolling window (default 180).
 *   - DISCONTINUITY: a gap > 500 ms (tab switch, system sleep) is ignored entirely — it
 *     enters neither the window, the budget seed, `frames`, nor `dropped`; timing simply
 *     resumes from the new timestamp (the QualityGovernor's "skip discontinuity frames"
 *     doctrine, given a concrete constant here).
 *   - percentile `pct(arr, p)`: nearest-rank-by-floor on the ascending sort —
 *     `sorted[Math.floor((p / 100) * (sorted.length - 1))]`; `null` when empty.
 *   - BUDGET DETECTION: the median (`pct(seed, 50)`) of the first `budgetSeed` (default 30)
 *     clean deltas — "clean" = past the discontinuity filter. Until the seed fills,
 *     `budgetMs` is `null` and nothing counts as dropped.
 *   - DROPPED: once the budget exists, a delta strictly greater than `budget × 1.5`
 *     increments `dropped` (cumulative, not windowed). The seed-completing delta is itself
 *     checked in the same feed — the DataConsole's exact ordering.
 *   - fps: `Math.round(1000 / medianMs)` over the current window; `null` while empty.
 *   - `frames`: total clean deltas ever counted (not capped by the window).
 *
 * Pure and host-driven by design: NO `requestAnimationFrame` of its own (callers feed their
 * loop's timestamps) and NO PerformanceObserver — the LoAF / long-task split stays page-side
 * in this slice (the DataConsole keeps its own observer; a platform LoAF lane is future work).
 */

export interface FieldPerfOptions {
  /** rolling delta-window size (default 180 — the DataConsole's ~3 s at 60 Hz). Min 1. */
  window?: number;
  /** number of clean deltas used to detect the frame budget (default 30); the budget is their median. Min 1. */
  budgetSeed?: number;
}

export interface FieldPerfSnapshot {
  /** `Math.round(1000 / medianMs)`; `null` until a delta exists. */
  fps: number | null;
  /** the detected frame budget (median of the seed deltas); `null` until the seed fills. */
  budgetMs: number | null;
  /** windowed median delta (`pct(deltas, 50)`); `null` while empty. */
  medianMs: number | null;
  /** windowed 95th-percentile delta; `null` while empty. */
  p95Ms: number | null;
  /** windowed 99th-percentile delta; `null` while empty. */
  p99Ms: number | null;
  /** cumulative deltas > budget × 1.5 since creation/reset (0 until the budget is detected). */
  dropped: number;
  /** total clean deltas counted since creation/reset (not capped by the window). */
  frames: number;
}

export interface FieldPerf {
  /** Feed one rAF timestamp (ms). Deltas are computed internally; gaps > 500 ms are ignored (discontinuity). */
  feed(frameTs: number): void;
  /** Read the current numbers (pure — no layout, no globals). */
  snapshot(): FieldPerfSnapshot;
  /** Forget everything: window, seed, budget, counters, and the last timestamp. */
  reset(): void;
}

/** A gap above this (ms) is a discontinuity — tab switch / sleep — and is skipped, not measured. */
const DISCONTINUITY_MS = 500;

/** Nearest-rank-by-floor percentile on a copy (the DataConsole's `pct`). `null` when empty. */
function pct(arr: readonly number[], p: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor((p / 100) * (s.length - 1))]!;
}

/** Create a frame-duration meter. Feed it rAF timestamps; read `snapshot()` whenever. */
export function createFieldPerf(opts: FieldPerfOptions = {}): FieldPerf {
  const windowSize = Math.max(1, Math.floor(opts.window ?? 180));
  const seedSize = Math.max(1, Math.floor(opts.budgetSeed ?? 30));

  let lastTs: number | null = null;
  let deltas: number[] = [];
  let seed: number[] = [];
  let budget: number | null = null;
  let dropped = 0;
  let frames = 0;

  const feed = (frameTs: number): void => {
    if (lastTs === null) {
      lastTs = frameTs;
      return;
    }
    const d = frameTs - lastTs;
    lastTs = frameTs;
    if (d > DISCONTINUITY_MS) return; // discontinuity: resume from the new timestamp, count nothing

    deltas.push(d);
    if (deltas.length > windowSize) deltas.shift();
    frames++;

    // detect the budget from the first `seedSize` clean deltas (median)
    if (budget === null && seed.length < seedSize) {
      seed.push(d);
      if (seed.length === seedSize) budget = pct(seed, 50);
    }

    // the seed-completing delta is checked too — the DataConsole's exact ordering
    if (budget !== null && d > budget * 1.5) dropped++;
  };

  const snapshot = (): FieldPerfSnapshot => {
    const medianMs = pct(deltas, 50);
    return {
      fps: medianMs ? Math.round(1000 / medianMs) : null,
      budgetMs: budget,
      medianMs,
      p95Ms: pct(deltas, 95),
      p99Ms: pct(deltas, 99),
      dropped,
      frames,
    };
  };

  const reset = (): void => {
    lastTs = null;
    deltas = [];
    seed = [];
    budget = null;
    dropped = 0;
    frames = 0;
  };

  return { feed, snapshot, reset };
}
