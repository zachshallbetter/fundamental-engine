/**
 * Metric library tests — the per-frame metric math is pure and node-testable (no DOM).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, METRIC_KINDS, type MetricInputs } from './metrics.ts';

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

const COMPUTED_KINDS = ['attention', 'memory', 'recency', 'coherence', 'entropy', 'pressure', 'risk', 'priority'] as const;

test('computeMetrics returns the computed lanes in [0,1]; confidence is absent unless supplied', () => {
  const m = computeMetrics({ ...base, proximity: 0.8, visible: 1 });
  for (const k of COMPUTED_KINDS) {
    assert.ok(k in m, `${k} present`);
    assert.ok(m[k] >= 0 && m[k] <= 1, `${k} in [0,1] (${m[k]})`);
  }
  assert.ok(!('confidence' in m), 'confidence absent when not supplied');
  // completeness: every metric kind is either a computed lane or the supplied-only `confidence`
  for (const k of METRIC_KINDS) assert.ok(k === 'confidence' || k in m, `${k} accounted for`);
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
