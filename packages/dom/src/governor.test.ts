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
