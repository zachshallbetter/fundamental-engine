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
 * Frame timing is host-driven by design: NO `requestAnimationFrame` of its own (callers feed
 * their loop's timestamps). The LoAF / long-task lane is the one optional exception — opt in with
 * `{ loaf: true }` and the meter attaches a `PerformanceObserver`, mirroring the DataConsole's
 * own observer byte-for-byte:
 *   - observes `'long-animation-frame'` (LoAF) when available, else falls back to `'longtask'`.
 *   - counts only entries with `duration >= 50` ms (the long-task / LoAF threshold).
 *   - `loafCount` is the running tally of those entries; `tbtMs` sums their blocking time as
 *     `Σ max(0, duration − 50)` — Total Blocking Time, the DataConsole's exact formula.
 *   - feature-detected and fully graceful: where `PerformanceObserver` (or the entry type) is
 *     unsupported the lane is a silent no-op (`loafCount` / `tbtMs` stay 0). Without `loaf`,
 *     the meter is pure (no observer, no globals) — existing callers are unchanged.
 * Call `dispose()` when done to disconnect the observer (a no-op when none was attached).
 */

export interface FieldPerfOptions {
  /** rolling delta-window size (default 180 — the DataConsole's ~3 s at 60 Hz). Min 1. */
  window?: number;
  /** number of clean deltas used to detect the frame budget (default 30); the budget is their median. Min 1. */
  budgetSeed?: number;
  /**
   * Observe Long Animation Frames / long tasks via `PerformanceObserver` (default false). When
   * enabled and supported, `snapshot()` reports `loafCount` / `tbtMs`; when unsupported it is a
   * silent no-op. Leave off to keep the meter pure (no observer, no globals).
   */
  loaf?: boolean;
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
  /**
   * Long Animation Frames / long tasks (`duration >= 50` ms) observed since creation/reset.
   * Always 0 unless `{ loaf: true }` was set and the observer is supported.
   */
  loafCount: number;
  /**
   * Total Blocking Time (ms): `Σ max(0, duration − 50)` over the observed LoAF / long-task
   * entries. Always 0 unless the LoAF lane is enabled and supported.
   */
  tbtMs: number;
}

export interface FieldPerf {
  /** Feed one rAF timestamp (ms). Deltas are computed internally; gaps > 500 ms are ignored (discontinuity). */
  feed(frameTs: number): void;
  /** Read the current numbers (pure — no layout, no globals). */
  snapshot(): FieldPerfSnapshot;
  /** Forget everything: window, seed, budget, counters, the last timestamp, and the LoAF tally. */
  reset(): void;
  /** Disconnect the LoAF / long-task observer (no-op when the lane is off or unsupported). */
  dispose(): void;
}

/** A gap above this (ms) is a discontinuity — tab switch / sleep — and is skipped, not measured. */
const DISCONTINUITY_MS = 500;

/** LoAF / long-task threshold (ms): entries at or above this are counted; the TBT floor too. */
const LOAF_MS = 50;

/** The shape of a `PerformanceObserver` entry we read — just its `duration` (ms). */
interface DurationEntry {
  readonly duration: number;
}

/**
 * Attach a LoAF / long-task observer, feeding each qualifying entry to `onEntry`. Tries
 * `'long-animation-frame'` first, falls back to `'longtask'`. Returns a disconnect fn, or a
 * no-op where `PerformanceObserver` (or both entry types) is unsupported — fully graceful.
 */
function observeLoaf(onEntry: (e: DurationEntry) => void): () => void {
  const PO = (globalThis as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
  if (typeof PO !== 'function') return () => {};
  for (const type of ['long-animation-frame', 'longtask'] as const) {
    try {
      const obs = new PO((list) => {
        for (const e of list.getEntries() as unknown as DurationEntry[]) {
          if (e.duration >= LOAF_MS) onEntry(e);
        }
      });
      obs.observe({ type, buffered: true } as PerformanceObserverInit);
      return () => obs.disconnect();
    } catch {
      // entry type unsupported in this engine — try the next, then give up gracefully
    }
  }
  return () => {};
}

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
  let loafCount = 0;
  let tbtMs = 0;

  // LoAF / long-task lane — opt-in, feature-detected, graceful no-op where unsupported.
  const disconnectLoaf = opts.loaf
    ? observeLoaf((e) => {
        loafCount++;
        tbtMs += Math.max(0, e.duration - LOAF_MS);
      })
    : () => {};

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
      loafCount,
      tbtMs,
    };
  };

  const reset = (): void => {
    lastTs = null;
    deltas = [];
    seed = [];
    budget = null;
    dropped = 0;
    frames = 0;
    loafCount = 0;
    tbtMs = 0;
  };

  const dispose = (): void => {
    disconnectLoaf();
  };

  return { feed, snapshot, reset, dispose };
}
