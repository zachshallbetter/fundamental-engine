/**
 * Temporal kernel tests — the world-time clock is pure math, so the shapes are pinned here:
 * boundaries, monotonicity, half-life exactness, the memory page's retention table, phase
 * wrapping, determinism, and NaN-safety on degenerate inputs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imminence, freshness, retention, phase, HOUR_MS, DAY_MS } from './temporal.ts';

const HORIZON_30D = 30 * DAY_MS;
const NOW = 1_750_000_000_000; // an arbitrary but fixed epoch instant

// ── imminence — the calendar's log-ramp ─────────────────────────────────────────────

test('imminence: 1 at and past the moment, 0 at and beyond the horizon', () => {
  assert.equal(imminence(NOW, NOW, HORIZON_30D), 1, 'at the moment');
  assert.equal(imminence(NOW - DAY_MS, NOW, HORIZON_30D), 1, 'past the moment');
  assert.equal(imminence(NOW + HORIZON_30D, NOW, HORIZON_30D), 0, 'at the horizon edge');
  assert.equal(imminence(NOW + 2 * HORIZON_30D, NOW, HORIZON_30D), 0, 'beyond the horizon clamps');
});

test('imminence: matches the calendar page form exactly (hours generalized to ms)', () => {
  // the calendar's 1 Hz clock: 1 − ln(hoursUntil + 1) / ln(24·30 + 1)
  for (const hours of [0.5, 1, 19, 24, 24 * 7, 24 * 29]) {
    const expected = 1 - Math.log(hours + 1) / Math.log(24 * 30 + 1);
    assert.equal(imminence(NOW + hours * HOUR_MS, NOW, HORIZON_30D), expected, `${hours}h out`);
  }
});

test('imminence: monotonically non-increasing as the moment recedes', () => {
  let prev = 1;
  for (let h = 0; h <= 24 * 31; h += 6) {
    const w = imminence(NOW + h * HOUR_MS, NOW, HORIZON_30D);
    assert.ok(w <= prev, `non-increasing at ${h}h (${w} > ${prev})`);
    assert.ok(w >= 0 && w <= 1, `in [0,1] at ${h}h`);
    prev = w;
  }
});

test('imminence: degenerate inputs are NaN-free', () => {
  assert.equal(imminence(NaN, NOW, HORIZON_30D), 0);
  assert.equal(imminence(NOW, NaN, HORIZON_30D), 0);
  assert.equal(imminence(NOW + DAY_MS, NOW, 0), 0, 'no horizon, future → 0');
  assert.equal(imminence(NOW + DAY_MS, NOW, -5), 0, 'negative horizon, future → 0');
  assert.equal(imminence(NOW - 1, NOW, 0), 1, 'no horizon, past → still 1');
  assert.equal(imminence(NOW + DAY_MS, NOW, NaN), 0);
  assert.equal(imminence(NOW + DAY_MS, NOW, Infinity), 0);
  for (const v of [NaN, Infinity, -Infinity]) assert.ok(!Number.isNaN(imminence(v, v, v)));
});

// ── freshness — exponential newness (staleness = 1 − freshness) ─────────────────────

test('freshness: 1 now, exactly 0.5 at one half-life, 0.25 at two, → 0', () => {
  const HL = 7 * DAY_MS;
  assert.equal(freshness(NOW, NOW, HL), 1);
  assert.equal(freshness(NOW - HL, NOW, HL), 0.5, 'half-life exactness');
  assert.equal(freshness(NOW - 2 * HL, NOW, HL), 0.25, 'two half-lives');
  assert.ok(Math.abs(freshness(NOW - HL / 2, NOW, HL) - Math.SQRT1_2) < 1e-12, 'half a half-life = 2^−0.5');
  assert.equal(freshness(NOW - 1e7 * HL, NOW, HL), 0, 'deep past underflows to 0, not NaN');
});

test('freshness: future timestamps clamp to 1; monotonically non-increasing with age', () => {
  const HL = DAY_MS;
  assert.equal(freshness(NOW + DAY_MS, NOW, HL), 1, 'nothing is fresher than now');
  let prev = 1;
  for (let d = 0; d <= 30; d++) {
    const f = freshness(NOW - d * DAY_MS, NOW, HL);
    assert.ok(f <= prev && f >= 0 && f <= 1, `non-increasing, in [0,1] at ${d}d`);
    prev = f;
  }
});

test('freshness: degenerate inputs are NaN-free', () => {
  assert.equal(freshness(NaN, NOW, DAY_MS), 0);
  assert.equal(freshness(NOW, NaN, DAY_MS), 0);
  assert.equal(freshness(NOW - 1, NOW, 0), 0, 'zero half-life: instant decay');
  assert.equal(freshness(NOW, NOW, 0), 1, 'zero half-life: still 1 at the moment');
  assert.equal(freshness(NOW - 1, NOW, NaN), 0);
  assert.equal(freshness(NOW - 1, NOW, -DAY_MS), 0);
});

// ── retention — the memory page's forgetting curve, lifted exactly ──────────────────

test('retention: matches the memory page table (w = a·exp(−days/τ), τ = 4 + a·56 days)', () => {
  // known points from the memory page's math, computed in its original day units
  for (const a of [0.15, 0.5, 0.78, 1]) {
    for (const days of [0, 1, 7, 30, 60]) {
      const pageW = a * Math.exp(-days / (4 + a * 56));
      const w = retention(a, days * DAY_MS);
      assert.ok(Math.abs(w - pageW) < 1e-12, `a=${a} days=${days}: ${w} vs page ${pageW}`);
    }
  }
});

test('retention: exactly the anchor at since=0; monotone decay; τ grows with the anchor', () => {
  assert.equal(retention(0.73, 0), 0.73, 'retention(a, 0) = a exactly');
  assert.equal(retention(0.73, -DAY_MS), 0.73, 'a future review holds full strength');
  let prev = 1;
  for (let d = 0; d <= 90; d += 5) {
    const w = retention(1, d * DAY_MS);
    assert.ok(w <= prev && w >= 0, `monotone at ${d}d`);
    prev = w;
  }
  // the stability term: at the same age, the deeper anchor holds a larger FRACTION of itself
  const shallow = retention(0.2, 14 * DAY_MS) / 0.2;
  const deep = retention(0.9, 14 * DAY_MS) / 0.9;
  assert.ok(deep > shallow, 'deep anchors decay slower');
});

test('retention: custom τ calibration and degenerate inputs', () => {
  // explicit calibration: τ = 10 days flat (no growth)
  const w = retention(1, 10 * DAY_MS, { tauBaseMs: 10 * DAY_MS, tauGrowthMs: 0 });
  assert.ok(Math.abs(w - Math.exp(-1)) < 1e-12);
  assert.equal(retention(1.5, 0), 1, 'anchor clamps to 1');
  assert.equal(retention(-0.5, 0), 0, 'anchor clamps to 0');
  assert.equal(retention(NaN, DAY_MS), 0);
  assert.equal(retention(0.5, NaN), 0);
  assert.equal(retention(0.5, DAY_MS, { tauBaseMs: 0, tauGrowthMs: 0 }), 0, 'τ=0: nothing held');
  for (const v of [NaN, Infinity, -Infinity]) assert.ok(!Number.isNaN(retention(v, v)));
});

// ── phase — cyclical 0..1 (consumer-less today; the shape is still pinned) ──────────

test('phase: wraps over the period and stays in [0, 1)', () => {
  assert.equal(phase(NOW, DAY_MS, NOW), 0, 'the offset is the cycle zero');
  assert.equal(phase(NOW + DAY_MS / 2, DAY_MS, NOW), 0.5, 'mid-cycle');
  assert.equal(phase(NOW + DAY_MS, DAY_MS, NOW), 0, 'the wrap point reads 0, never 1');
  assert.equal(phase(NOW + 2.25 * DAY_MS, DAY_MS, NOW), 0.25, 'wraps over multiple periods');
  for (let t = -3.5 * DAY_MS; t <= 3.5 * DAY_MS; t += DAY_MS / 3) {
    const p = phase(NOW + t, DAY_MS, NOW);
    assert.ok(p >= 0 && p < 1, `in [0,1) at t=${t}`);
  }
});

test('phase: times before the offset wrap sign-safely; degenerate inputs are NaN-free', () => {
  assert.equal(phase(NOW - DAY_MS / 4, DAY_MS, NOW), 0.75, 'a quarter before the zero = 0.75');
  assert.equal(phase(NaN, DAY_MS), 0);
  assert.equal(phase(NOW, 0), 0);
  assert.equal(phase(NOW, -DAY_MS), 0);
  assert.equal(phase(NOW, NaN), 0);
  assert.equal(phase(NOW, DAY_MS, NaN), 0);
});

// ── determinism ──────────────────────────────────────────────────────────────────────

test('the kernels are deterministic: same inputs, same outputs', () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(imminence(NOW + 9 * HOUR_MS, NOW, HORIZON_30D), imminence(NOW + 9 * HOUR_MS, NOW, HORIZON_30D));
    assert.equal(freshness(NOW - 9 * HOUR_MS, NOW, DAY_MS), freshness(NOW - 9 * HOUR_MS, NOW, DAY_MS));
    assert.equal(retention(0.6, 9 * DAY_MS), retention(0.6, 9 * DAY_MS));
    assert.equal(phase(NOW + 9 * HOUR_MS, DAY_MS), phase(NOW + 9 * HOUR_MS, DAY_MS));
  }
});
