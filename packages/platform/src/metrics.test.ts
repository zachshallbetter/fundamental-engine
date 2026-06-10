/**
 * Metric library tests — the per-frame metric math is pure and node-testable (no DOM).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMetrics,
  groundedRecency,
  parseFieldAt,
  DEFAULT_RECENCY_HALF_LIFE_MS,
  METRIC_KINDS,
  type MetricInputs,
} from './metrics.ts';

const base: MetricInputs = {
  proximity: 0,
  visible: 0,
  engaged: false,
  dtFrames: 1,
  relResolved: 0,
  relTotal: 0,
  relConflict: 0,
  supplied: {},
  prev: {},
};

const COMPUTED_KINDS = ['attention', 'memory', 'recency', 'coherence', 'entropy', 'pressure', 'priority'] as const;

test('computeMetrics returns the computed lanes in [0,1]; confidence + risk are absent unless supplied', () => {
  const m = computeMetrics({ ...base, proximity: 0.8, visible: 1 });
  for (const k of COMPUTED_KINDS) {
    assert.ok(k in m, `${k} present`);
    assert.ok(m[k] >= 0 && m[k] <= 1, `${k} in [0,1] (${m[k]})`);
  }
  assert.ok(!('confidence' in m), 'confidence absent when not supplied');
  assert.ok(!('risk' in m), 'risk absent when not supplied');
  // completeness: every metric kind is either a computed lane or a supplied-only lane (confidence/risk)
  for (const k of METRIC_KINDS) assert.ok(k === 'confidence' || k === 'risk' || k in m, `${k} accounted for`);
});

test('attention rises with proximity + visibility, and engagement boosts it', () => {
  const far = computeMetrics({ ...base, proximity: 0.2, visible: 1 });
  const near = computeMetrics({ ...base, proximity: 0.9, visible: 1 });
  assert.ok(near.attention > far.attention);
  const calm = computeMetrics({ ...base, proximity: 0.6, visible: 1, engaged: false });
  const engaged = computeMetrics({ ...base, proximity: 0.6, visible: 1, engaged: true });
  assert.ok(engaged.attention > calm.attention);
});

test('memory accrues under high attention and decays under low', () => {
  const up = computeMetrics({ ...base, proximity: 1, visible: 1, prev: { memory: 0.5 } });
  assert.ok(up.memory > 0.5, 'accrues');
  const down = computeMetrics({ ...base, proximity: 0, visible: 0, prev: { memory: 0.5 } });
  assert.ok(down.memory < 0.5, 'decays');
});

test('coherence/entropy derive from relationship resolution + conflict', () => {
  const clean = computeMetrics({ ...base, relTotal: 4, relResolved: 4, relConflict: 0 });
  assert.ok(clean.coherence > 0.9 && clean.entropy < 0.2);
  const contested = computeMetrics({ ...base, relTotal: 4, relResolved: 4, relConflict: 2 });
  assert.ok(contested.coherence < clean.coherence && contested.entropy > clean.entropy);
});

test('supplied values override computed ones (confidence/risk/priority are data-driven)', () => {
  const m = computeMetrics({ ...base, proximity: 1, visible: 1, supplied: { risk: 0.9, confidence: 0.3 } });
  assert.equal(m.risk, 0.9);
  assert.equal(m.confidence, 0.3);
});

test('confidence is never fabricated from relationship presence', () => {
  // no supplied confidence + no relationships → absent (not 0)
  const none = computeMetrics({ ...base });
  assert.ok(!('confidence' in none), 'absent with no relationships');
  // no supplied confidence + fully-resolved relationships → STILL absent (a citation is not certainty)
  const cited = computeMetrics({ ...base, relTotal: 3, relResolved: 3, relConflict: 0 });
  assert.ok(!('confidence' in cited), 'absent even with fully-resolved relationships');
  assert.ok(cited.coherence > 0.9, 'relationship resolution still drives coherence — just not confidence');
});

test('confidence is present only when supplied, and is clamped to [0,1]', () => {
  assert.equal(computeMetrics({ ...base, supplied: { confidence: 0.62 } }).confidence, 0.62);
  assert.equal(computeMetrics({ ...base, supplied: { confidence: 1.5 } }).confidence, 1, 'out-of-range supplied confidence is clamped');
});

test('a declared data-field-at GROUNDS the recency lane; without one it stays interaction-inferred', () => {
  const now = 1_750_000_000_000;
  // a fake element whose data happened half a half-life ago (3.5 days on the 7-day default)
  const at = now - DEFAULT_RECENCY_HALF_LIFE_MS / 2;
  const el = { getAttribute: (n: string) => (n === 'data-field-at' ? String(at) : null) };
  const grounded = groundedRecency(el, now);
  assert.ok(grounded != null && Math.abs(grounded - Math.SQRT1_2) < 1e-12, 'freshness(half a half-life) = 2^−0.5');
  // the grounded value rides the supplied lane and wins over the interaction-inferred path
  const m = computeMetrics({ ...base, supplied: { recency: grounded }, prev: { recency: 0.2 } });
  assert.ok(Math.abs(m.recency - grounded!) < 1e-12, 'grounded recency lands in the lane');
  // the DEFAULT path (no timestamp) is unchanged: recency eases down from the prior frame
  const inferred = computeMetrics({ ...base, prev: { recency: 0.2 } });
  assert.ok(Math.abs(inferred.recency - 0.197) < 1e-9, 'interaction-inferred decay (0.2 − 0.003)');
  // an explicit data-field-recency wins over the timestamp (apply-recipe only derives when absent)
  const explicit = computeMetrics({ ...base, supplied: { recency: 0.9 } });
  assert.equal(explicit.recency, 0.9);
});

test('parseFieldAt accepts ISO 8601 and epoch ms; invalid reads as absent', () => {
  assert.equal(parseFieldAt('2026-06-10T00:00:00Z'), Date.parse('2026-06-10T00:00:00Z'), 'ISO 8601');
  assert.equal(parseFieldAt('1750000000000'), 1_750_000_000_000, 'epoch ms');
  assert.equal(parseFieldAt('not a timestamp'), undefined);
  assert.equal(parseFieldAt(''), undefined);
  assert.equal(parseFieldAt(null), undefined);
  // no declared timestamp → no grounding (the caller falls through to the inferred path)
  assert.equal(groundedRecency({ getAttribute: () => null }, 1_750_000_000_000), undefined);
});

test('data-field-halflife (ms) overrides the 7-day default; invalid half-lives fall back', () => {
  const now = 1_750_000_000_000;
  const at = now - 86_400_000; // one day ago
  const attrs = (halflife: string | null) => ({
    getAttribute: (n: string) =>
      n === 'data-field-at' ? String(at) : n === 'data-field-halflife' ? halflife : null,
  });
  assert.equal(groundedRecency(attrs('86400000'), now), 0.5, 'one-day half-life: exactly 0.5 a day later');
  const week = groundedRecency(attrs(null), now);
  assert.ok(week != null && Math.abs(week - Math.pow(2, -1 / 7)) < 1e-12, 'default 7-day half-life');
  assert.equal(groundedRecency(attrs('junk'), now), week, 'invalid half-life falls back to the default');
  assert.equal(groundedRecency(attrs('-5'), now), week, 'non-positive half-life falls back to the default');
});

test('risk is never defaulted to safe — absent unless supplied', () => {
  // "no risk" is a claim the engine has no basis to make; the old `risk: 0` asserted it for everything.
  const none = computeMetrics({ ...base, proximity: 1, visible: 1 });
  assert.ok(!('risk' in none), 'risk absent by default (not 0)');
  // even a fully-resolved, calm element gets no risk asserted on its behalf
  const calm = computeMetrics({ ...base, relTotal: 3, relResolved: 3, relConflict: 0 });
  assert.ok(!('risk' in calm), 'risk still absent — resolution is not a safety signal');
  // present + clamped only when the host supplies it
  assert.equal(computeMetrics({ ...base, supplied: { risk: 0.8 } }).risk, 0.8);
  assert.equal(computeMetrics({ ...base, supplied: { risk: 1.5 } }).risk, 1, 'out-of-range supplied risk is clamped');
});
