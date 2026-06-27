/**
 * createFieldPerf tests — pinning the exact semantics lifted from the DataConsole prototype
 * so its conversion is behavior-identical: nearest-rank-by-floor percentiles, budget = median
 * of the first N clean deltas, dropped = delta strictly > budget × 1.5 (checked on the
 * seed-completing delta too — the prototype's ordering), the > 500 ms discontinuity skip,
 * the rolling window cap, and reset.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFieldPerf } from './perf.ts';

/** Feed a delta sequence as accumulating timestamps (first feed only arms the clock). */
function feedDeltas(perf: ReturnType<typeof createFieldPerf>, deltas: readonly number[], start = 0): number {
  let t = start;
  perf.feed(t);
  for (const d of deltas) {
    t += d;
    perf.feed(t);
  }
  return t;
}

/** The DataConsole's pct(): nearest-rank-by-floor on the ascending sort. */
const pctRef = (arr: number[], p: number): number => [...arr].sort((a, b) => a - b)[Math.floor((p / 100) * (arr.length - 1))]!;

test('empty meter: every lane null/zero; the first feed produces no frame', () => {
  const perf = createFieldPerf();
  assert.deepEqual(perf.snapshot(), { fps: null, budgetMs: null, medianMs: null, p95Ms: null, p99Ms: null, dropped: 0, frames: 0, loafCount: 0, tbtMs: 0 });
  perf.feed(1000);
  assert.equal(perf.snapshot().frames, 0, 'a single timestamp is not a delta');
});

test('known delta sequence → exact percentiles, budget, fps, dropped', () => {
  // budget from the first 4 clean deltas: pct([10,10,10,10], 50) = 10
  const perf = createFieldPerf({ budgetSeed: 4 });
  const deltas = [10, 10, 10, 10, 12, 14, 16, 20, 30];
  feedDeltas(perf, deltas);

  const s = perf.snapshot();
  assert.equal(s.budgetMs, 10, 'budget = median of the seed deltas');
  assert.equal(s.medianMs, pctRef(deltas, 50));
  assert.equal(s.p95Ms, pctRef(deltas, 95));
  assert.equal(s.p99Ms, pctRef(deltas, 99));
  assert.equal(s.medianMs, 12, 'sorted [10,10,10,10,12,14,16,20,30] → index floor(.5·8)=4');
  assert.equal(s.p95Ms, 20, 'index floor(.95·8)=7');
  assert.equal(s.p99Ms, 20, 'index floor(.99·8)=7');
  assert.equal(s.fps, Math.round(1000 / 12), 'fps rounds 1000/median');
  // dropped: > 10·1.5 = 15 strictly → 16, 20, 30 (12 and 14 are under; 16 > 15)
  assert.equal(s.dropped, 3);
  assert.equal(s.frames, 9);
});

test('dropped is strict (> budget×1.5, not ≥) and inert until the budget exists', () => {
  const perf = createFieldPerf({ budgetSeed: 2 });
  // pre-budget: even a huge clean delta cannot be dropped
  feedDeltas(perf, [400]); // seed has 1 of 2 — no budget yet
  assert.equal(perf.snapshot().dropped, 0, 'no budget → nothing drops');
  perf.reset();

  feedDeltas(perf, [10, 10, 15, 15.0001]);
  const s = perf.snapshot();
  assert.equal(s.budgetMs, 10);
  assert.equal(s.dropped, 1, 'exactly 1.5× is NOT dropped; strictly above is');
});

test('the seed-completing delta is itself checked against the fresh budget (prototype ordering)', () => {
  const perf = createFieldPerf({ budgetSeed: 2 });
  // seed = [10, 30] → budget = pct([10,30], 50) = sorted[floor(.5·1)] = 10; then 30 > 15 → dropped
  feedDeltas(perf, [10, 30]);
  const s = perf.snapshot();
  assert.equal(s.budgetMs, 10);
  assert.equal(s.dropped, 1, 'the delta that completed the seed was judged in the same feed');
});

test('gaps > 500 ms are discontinuities: skipped entirely, timing resumes from the new timestamp', () => {
  const perf = createFieldPerf({ budgetSeed: 2 });
  let t = feedDeltas(perf, [16, 16]); // budget = 16
  perf.feed(t + 600); // tab switch — not a frame, not dropped, not in the window
  t += 600;
  let s = perf.snapshot();
  assert.equal(s.frames, 2, 'the gap did not count as a frame');
  assert.equal(s.dropped, 0, 'the gap did not count as dropped');
  assert.equal(s.p99Ms, 16, 'the gap never entered the window');

  perf.feed(t + 16); // the next real frame measures from the post-gap timestamp
  s = perf.snapshot();
  assert.equal(s.frames, 3);
  assert.equal(s.medianMs, 16);

  // exactly 500 is NOT a discontinuity (strictly greater than)
  perf.feed(t + 16 + 500);
  assert.equal(perf.snapshot().frames, 4);
  assert.equal(perf.snapshot().dropped, 1, '500 ms is a (very) dropped frame, not a gap');
});

test('a discontinuity also bypasses the budget seed (clean deltas only)', () => {
  const perf = createFieldPerf({ budgetSeed: 2 });
  feedDeltas(perf, [10, 501, 10]); // 501 skipped — the seed is [10, 10]
  assert.equal(perf.snapshot().budgetMs, 10);
  assert.equal(perf.snapshot().frames, 2);
});

test('the window caps percentile inputs but frames/dropped stay cumulative', () => {
  const perf = createFieldPerf({ window: 5, budgetSeed: 2 });
  feedDeltas(perf, [10, 10, 100, 4, 5, 6, 7, 8]); // window holds the last 5: [4,5,6,7,8]
  const s = perf.snapshot();
  assert.equal(s.medianMs, 6, 'the 100 ms spike fell out of the window');
  assert.equal(s.p99Ms, 7, 'nearest-rank-by-floor: floor(.99·4) = 3 → sorted[3]');
  assert.equal(s.frames, 8, 'frames count everything clean, not just the window');
  assert.equal(s.dropped, 1, 'the spike was counted when it happened and stays counted');
});

test('reset forgets everything, including the armed timestamp', () => {
  const perf = createFieldPerf({ budgetSeed: 2 });
  const t = feedDeltas(perf, [10, 10, 30]);
  assert.notEqual(perf.snapshot().frames, 0);

  perf.reset();
  assert.deepEqual(perf.snapshot(), { fps: null, budgetMs: null, medianMs: null, p95Ms: null, p99Ms: null, dropped: 0, frames: 0, loafCount: 0, tbtMs: 0 });

  // the clock is disarmed: the next feed is a first feed, not a 10 000 ms gap judgement
  perf.feed(t + 10_000);
  assert.equal(perf.snapshot().frames, 0);
  perf.feed(t + 10_016);
  assert.equal(perf.snapshot().frames, 1);
  assert.equal(perf.snapshot().medianMs, 16);
});

// ── LoAF / long-task lane (mocked PerformanceObserver) ─────────────────────

/**
 * Install a fake `PerformanceObserver` on `globalThis` that captures the observed init and lets
 * the test push entries to the registered callback. Returns the controls + a restore fn.
 */
function mockPerformanceObserver(opts: { throwOnTypes?: readonly string[] } = {}) {
  const prev = (globalThis as Record<string, unknown>).PerformanceObserver;
  const observed: string[] = [];
  let cb: ((list: { getEntries(): { duration: number }[] }) => void) | null = null;
  let disconnects = 0;

  class FakePO {
    constructor(callback: (list: { getEntries(): { duration: number }[] }) => void) {
      cb = callback;
    }
    observe(init: { type: string }) {
      if (opts.throwOnTypes?.includes(init.type)) throw new Error(`unsupported: ${init.type}`);
      observed.push(init.type);
    }
    disconnect() {
      disconnects++;
    }
  }
  (globalThis as Record<string, unknown>).PerformanceObserver = FakePO as unknown;

  return {
    observed,
    get disconnects() {
      return disconnects;
    },
    /** Emit a batch of entry durations (ms) to the meter's callback. */
    emit(...durations: number[]) {
      cb?.({ getEntries: () => durations.map((duration) => ({ duration })) });
    },
    restore() {
      if (prev === undefined) delete (globalThis as Record<string, unknown>).PerformanceObserver;
      else (globalThis as Record<string, unknown>).PerformanceObserver = prev;
    },
  };
}

test('loaf disabled by default: no observer is attached, lane stays zero', () => {
  const po = mockPerformanceObserver();
  try {
    const perf = createFieldPerf();
    po.emit(120); // even if something fired, a disabled meter never subscribed
    const s = perf.snapshot();
    assert.equal(po.observed.length, 0, 'no observe() call without { loaf: true }');
    assert.equal(s.loafCount, 0);
    assert.equal(s.tbtMs, 0);
  } finally {
    po.restore();
  }
});

test('loaf enabled: counts entries >= 50 ms and sums TBT = Σ max(0, dur − 50)', () => {
  const po = mockPerformanceObserver();
  try {
    const perf = createFieldPerf({ loaf: true });
    assert.deepEqual(po.observed, ['long-animation-frame'], 'prefers the LoAF entry type');
    po.emit(120, 49, 50, 200); // 49 ignored; 50,120,200 counted
    const s = perf.snapshot();
    assert.equal(s.loafCount, 3, 'three entries cleared the 50 ms threshold');
    assert.equal(s.tbtMs, 70 + 0 + 150, 'TBT = (120−50)+(50−50)+(200−50)');
  } finally {
    po.restore();
  }
});

test('loaf falls back to longtask when long-animation-frame is unsupported', () => {
  const po = mockPerformanceObserver({ throwOnTypes: ['long-animation-frame'] });
  try {
    const perf = createFieldPerf({ loaf: true });
    assert.deepEqual(po.observed, ['longtask'], 'fell back after LoAF threw');
    po.emit(80);
    assert.equal(perf.snapshot().loafCount, 1);
    assert.equal(perf.snapshot().tbtMs, 30);
  } finally {
    po.restore();
  }
});

test('loaf is a graceful no-op where PerformanceObserver is unavailable', () => {
  const prev = (globalThis as Record<string, unknown>).PerformanceObserver;
  delete (globalThis as Record<string, unknown>).PerformanceObserver;
  try {
    const perf = createFieldPerf({ loaf: true }); // must not throw
    const s = perf.snapshot();
    assert.equal(s.loafCount, 0);
    assert.equal(s.tbtMs, 0);
    perf.dispose(); // also a no-op
  } finally {
    if (prev === undefined) delete (globalThis as Record<string, unknown>).PerformanceObserver;
    else (globalThis as Record<string, unknown>).PerformanceObserver = prev;
  }
});

test('reset clears the LoAF tally; dispose disconnects the observer', () => {
  const po = mockPerformanceObserver();
  try {
    const perf = createFieldPerf({ loaf: true });
    po.emit(100);
    assert.equal(perf.snapshot().loafCount, 1);

    perf.reset();
    const s = perf.snapshot();
    assert.equal(s.loafCount, 0, 'reset forgets observed entries');
    assert.equal(s.tbtMs, 0);

    perf.dispose();
    assert.equal(po.disconnects, 1, 'dispose disconnected the observer');
  } finally {
    po.restore();
  }
});
