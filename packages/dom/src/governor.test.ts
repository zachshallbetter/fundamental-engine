/**
 * QualityGovernor tests — pure tier-transition logic: escalation streaks, the asymmetric
 * recovery run, discontinuity behavior at the caller's discretion, and reset.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QualityGovernor } from './governor.ts';

/** Feed `n` frames of `ms` and return every tier transition emitted. */
function feedRun(g: QualityGovernor, ms: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = g.feed(ms);
    if (t !== undefined) out.push(t);
  }
  return out;
}

test('governor: stays at tier 0 under budget', () => {
  const g = new QualityGovernor();
  assert.deepEqual(feedRun(g, 10, 100), []);
  assert.equal(g.tier, 0);
});

test('governor: escalates to tier 1 after 10 consecutive frames above 20ms', () => {
  const g = new QualityGovernor();
  assert.deepEqual(feedRun(g, 25, 9), [], 'no escalation before the streak completes');
  assert.equal(g.feed(25), 1, 'the 10th overrun frame fires tier 1');
  assert.equal(g.tier, 1);
  assert.deepEqual(feedRun(g, 25, 5), [], 'no re-emission while the tier holds');
});

test('governor: a clean frame resets the overrun streak', () => {
  const g = new QualityGovernor();
  feedRun(g, 25, 9);
  g.feed(10); // clean — streak resets
  assert.deepEqual(feedRun(g, 25, 9), [], 'streak starts over');
  assert.equal(g.feed(25), 1);
});

test('governor: heavy frames escalate straight to tier 3 on a short streak', () => {
  const g = new QualityGovernor();
  assert.deepEqual(feedRun(g, 60, 2), []);
  assert.equal(g.feed(60), 3, '3 consecutive frames above 50ms jump to tier 3');
});

test('governor: recovers one tier per 30 clean frames', () => {
  const g = new QualityGovernor();
  feedRun(g, 60, 3); // → tier 3
  assert.deepEqual(feedRun(g, 10, 29), [], 'recovery needs the full clean run');
  assert.equal(g.feed(10), 2, '30th clean frame drops one tier');
  assert.equal(g.feed(10 /* frame 1 of the next run */), undefined);
  feedRun(g, 10, 28);
  assert.equal(g.feed(10), 1, 'another 30 clean frames drop the next tier');
});

test('governor: an overrun during recovery restarts the clean run', () => {
  const g = new QualityGovernor();
  feedRun(g, 60, 3); // → tier 3
  feedRun(g, 10, 20);
  g.feed(60); // overrun resets cleanStreak
  assert.deepEqual(feedRun(g, 10, 29), [], 'the clean run starts over');
  assert.equal(g.feed(10), 2);
});

test('governor: reset returns to tier 0 and clears streaks', () => {
  const g = new QualityGovernor();
  feedRun(g, 60, 3);
  assert.equal(g.tier, 3);
  g.reset();
  assert.equal(g.tier, 0);
  assert.deepEqual(feedRun(g, 25, 9), [], 'streak state was cleared too');
});

// ── frame budget (engine audit 2026-10-14, M6) ──────────────────────────────────────────────────
// The thresholds used to be absolute 60 Hz milliseconds, so a steady 30 Hz display escalated to
// tier 2 within a handful of frames and never recovered. They now scale with the budget.

test('governor: a steady 30 Hz frame is on budget once the budget is 33.3 ms', () => {
  const at60 = new QualityGovernor();
  assert.ok(feedRun(at60, 1000 / 30, 20).includes(2), 'at the default 60 Hz budget, 33 ms frames escalate (the old behaviour)');

  const at30 = new QualityGovernor(1000 / 30);
  assert.deepEqual(feedRun(at30, 1000 / 30, 600), [], 'at a 30 Hz budget they are clean');
  assert.equal(at30.tier, 0);
});

test('governor: thresholds scale with the budget — a 30 Hz budget escalates at 2× the 60 Hz times', () => {
  const g = new QualityGovernor(1000 / 30);
  assert.deepEqual(feedRun(g, 42, 30), [], '42 ms is within 1.3× a 33.3 ms budget (43.3 ms)');
  assert.deepEqual(feedRun(g, 50, 9), [], 'tier 1 needs 10 consecutive overruns');
  assert.equal(g.feed(50), 1, '50 ms (> 40 ms, the scaled 20 ms threshold) × 10 → tier 1');
  assert.equal(new QualityGovernor(1000 / 30).budgetMs, 1000 / 30);
});

test('governor: setBudget re-bases the thresholds, restarts the streaks, keeps the tier', () => {
  const g = new QualityGovernor();
  feedRun(g, 25, 10); // → tier 1 at 60 Hz
  assert.equal(g.tier, 1);
  feedRun(g, 25, 4); // a partial streak, counted against 16.67 ms
  g.setBudget(1000 / 30);
  assert.equal(g.tier, 1, 'the tier is kept');
  assert.equal(g.budgetMs, 1000 / 30);
  assert.deepEqual(feedRun(g, 25, 29), [], '25 ms is clean at 30 Hz; recovery needs 30 clean frames');
  assert.equal(g.feed(25), 0, 'and the 30th recovers');
});

test('governor: a non-finite or non-positive budget is ignored', () => {
  const g = new QualityGovernor(Number.NaN);
  assert.equal(g.budgetMs, 16.67, 'constructor falls back to the default');
  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) g.setBudget(bad);
  assert.equal(g.budgetMs, 16.67);
});
