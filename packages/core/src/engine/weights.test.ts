/**
 * Weight primitive tests — the page-weight → body-strength contract is pure math, so the shapes
 * are pinned here: the evidence page's exact trust values, monotonicity, clamps, the strength
 * endpoints, the degenerate matrix, and determinism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  logNormalize,
  logNormalizeAll,
  logNormalizeBetween,
  weightToStrength,
  WEIGHT_STRENGTH_BASE,
  WEIGHT_STRENGTH_SPAN,
} from './weights.ts';

// The evidence page's "does exercise improve mental health" topic — real OpenAlex citation
// counts from apps/site/src/data/evidence.json (the committed snapshot the page renders).
const EVIDENCE_CITES = [6046, 3407, 1983, 2012, 2389, 10851, 3093, 2198, 2787, 1829, 2488, 13672];
const EVIDENCE_MAX = 13672;

// ── logNormalize — the family's log "consensus" shape ───────────────────────────────

test('logNormalize: matches the evidence page form exactly (ln(x+1)/ln(max+1))', () => {
  // the page: lmax = Math.log(Math.max(...citedBy, 1) + 1); trust = Math.log(citedBy + 1) / lmax
  const lmax = Math.log(Math.max(...EVIDENCE_CITES, 1) + 1);
  for (const cites of EVIDENCE_CITES) {
    const pageTrust = Math.log(cites + 1) / lmax;
    assert.equal(logNormalize(cites, EVIDENCE_MAX), pageTrust, `citedBy ${cites}: bit-for-bit`);
  }
  // the headline case, spelled out: 6,046 citations against the topic max of 13,672
  assert.equal(logNormalize(6046, 13672), Math.log(6047) / Math.log(13673));
});

test('logNormalize: zero stays zero, the max reads exactly 1, heavy tails compress', () => {
  assert.equal(logNormalize(0, EVIDENCE_MAX), 0, 'zero stays zero');
  assert.equal(logNormalize(EVIDENCE_MAX, EVIDENCE_MAX), 1, 'value === max reads exactly 1');
  // compression: a ~500× magnitude gap reads as a far smaller weight gap
  const small = logNormalize(27, EVIDENCE_MAX);
  const large = logNormalize(13672, EVIDENCE_MAX);
  assert.ok(large / small < 4, `ln compresses 500× into <4× (${large / small})`);
});

test('logNormalize: monotonically non-decreasing in value for a fixed max', () => {
  let prev = 0;
  for (let v = 0; v <= EVIDENCE_MAX; v += 211) {
    const w = logNormalize(v, EVIDENCE_MAX);
    assert.ok(w >= prev, `non-decreasing at ${v} (${w} < ${prev})`);
    assert.ok(w >= 0 && w <= 1, `in [0,1] at ${v}`);
    prev = w;
  }
});

test('logNormalize: degenerate matrix is NaN-free', () => {
  // max ≤ 0 (or non-finite) → 0 for every value
  for (const max of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(logNormalize(5, max), 0, `max=${max} → 0`);
  }
  // negative / NaN / −Infinity values → 0
  for (const v of [-1, -1000, NaN, -Infinity]) {
    assert.equal(logNormalize(v, 100), 0, `value=${v} → 0`);
  }
  // above the max (stale max during a live update) clamps to 1
  assert.equal(logNormalize(200, 100), 1, 'value > max clamps to 1');
  assert.equal(logNormalize(Infinity, 100), 1, '+Infinity clamps to 1');
  for (const v of [NaN, Infinity, -Infinity]) assert.ok(!Number.isNaN(logNormalize(v, v)));
});

// ── logNormalizeAll — the whole set in one pass ──────────────────────────────────────

test('logNormalizeAll: index-aligned weights against the set max, max returned', () => {
  const { weights, max } = logNormalizeAll(EVIDENCE_CITES);
  assert.equal(max, EVIDENCE_MAX, 'the set max comes back for live re-normalization');
  assert.equal(weights.length, EVIDENCE_CITES.length, 'index-aligned');
  EVIDENCE_CITES.forEach((v, i) => {
    assert.equal(weights[i], logNormalize(v, EVIDENCE_MAX), `weights[${i}] = logNormalize(${v}, max)`);
  });
  assert.equal(weights[EVIDENCE_CITES.indexOf(EVIDENCE_MAX)], 1, 'the largest entry reads exactly 1');
});

test('logNormalizeAll: degenerate sets — empty, all-zero, negatives/NaN as 0', () => {
  assert.deepEqual(logNormalizeAll([]), { weights: [], max: 0 }, 'empty set');
  assert.deepEqual(logNormalizeAll([0, 0, 0]), { weights: [0, 0, 0], max: 0 }, 'all-zero counts → all-zero weights');
  const { weights, max } = logNormalizeAll([-5, NaN, 10, 0]);
  assert.equal(max, 10, 'negatives/NaN never set the max');
  assert.deepEqual(weights, [0, 0, 1, 0], 'negative and NaN entries read as 0');
  // a +Infinity entry clamps to 1 but does not poison the max
  const inf = logNormalizeAll([Infinity, 10]);
  assert.equal(inf.max, 10);
  assert.deepEqual(inf.weights, [1, 1]);
});

// ── weightToStrength — the data-strength contract ────────────────────────────────────

test('weightToStrength: the exact form 0.4 + w·1.6, endpoints exact', () => {
  assert.equal(weightToStrength(0), 0.4, 'w=0 → the 0.4 floor');
  assert.equal(weightToStrength(1), 2.0, 'w=1 → the 2.0 ceiling');
  assert.equal(WEIGHT_STRENGTH_BASE, 0.4);
  assert.equal(WEIGHT_STRENGTH_SPAN, 1.6);
  assert.equal(WEIGHT_STRENGTH_BASE + WEIGHT_STRENGTH_SPAN, 2.0, 'base + span = the ceiling');
  // bit-for-bit the example runtimes' expression, including through .toFixed(2)
  for (const w of [0, 0.07, 0.25, 0.5, 0.73, 1]) {
    assert.equal(weightToStrength(w), 0.4 + w * 1.6, `w=${w}: same number`);
    assert.equal(weightToStrength(w).toFixed(2), (0.4 + w * 1.6).toFixed(2), `w=${w}: same attribute string`);
  }
});

test('weightToStrength: monotone over 0..1; out-of-range clamps to the endpoints', () => {
  let prev = 0;
  for (let w = 0; w <= 1.0001; w += 0.05) {
    const s = weightToStrength(w);
    assert.ok(s >= prev && s >= 0.4 && s <= 2.0, `monotone, in [0.4, 2.0] at w=${w}`);
    prev = s;
  }
  assert.equal(weightToStrength(-0.5), 0.4, 'below 0 clamps to the floor');
  assert.equal(weightToStrength(1.5), 2.0, 'above 1 clamps to the ceiling');
  assert.equal(weightToStrength(-Infinity), 0.4);
  assert.equal(weightToStrength(Infinity), 2.0);
  assert.equal(weightToStrength(NaN), 0.4, 'NaN reads as a light body, not a NaN attribute');
});

// ── the composed contract + determinism ──────────────────────────────────────────────

test('the composed pipeline matches EvidenceRuntime: cites → trust → data-strength', () => {
  // EvidenceRuntime.ts: t = Math.log(cites+1)/lmax; dataset.strength = (0.4 + t * 1.6).toFixed(2)
  const lmax = Math.log(Math.max(...EVIDENCE_CITES, 1) + 1);
  for (const cites of EVIDENCE_CITES) {
    const runtimeAttr = (0.4 + (Math.log(cites + 1) / lmax) * 1.6).toFixed(2);
    const extracted = weightToStrength(logNormalize(cites, EVIDENCE_MAX)).toFixed(2);
    assert.equal(extracted, runtimeAttr, `citedBy ${cites}: the attribute string is identical`);
  }
});

test('the primitives are deterministic: same inputs, same outputs', () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(logNormalize(6046, EVIDENCE_MAX), logNormalize(6046, EVIDENCE_MAX));
    assert.deepEqual(logNormalizeAll(EVIDENCE_CITES), logNormalizeAll(EVIDENCE_CITES));
    assert.equal(weightToStrength(0.42), weightToStrength(0.42));
  }
});

test("logNormalizeBetween: bit-identical to the pages' min-max hand-roll", () => {
  // the market.astro shape: (ln(v+1) − lmin) / (lmax − lmin)
  const caps = [1238649891745, 197500000000, 186800000000, 591.2];
  const lmin = Math.log(Math.min(...caps) + 1);
  const lmax = Math.log(Math.max(...caps) + 1);
  for (const v of caps) {
    const hand = (Math.log(v + 1) - lmin) / (lmax - lmin);
    assert.equal(logNormalizeBetween(v, Math.min(...caps), Math.max(...caps)), hand);
  }
});

test("logNormalizeBetween: endpoints, monotonicity, clamps", () => {
  assert.equal(logNormalizeBetween(10, 10, 1000), 0);
  assert.equal(logNormalizeBetween(1000, 10, 1000), 1);
  const a = logNormalizeBetween(50, 10, 1000);
  const b = logNormalizeBetween(500, 10, 1000);
  assert.ok(a > 0 && b < 1 && a < b, "monotone in value");
  assert.equal(logNormalizeBetween(5, 10, 1000), 0, "below min clamps to 0");
  assert.equal(logNormalizeBetween(2000, 10, 1000), 1, "above max clamps to 1");
});

test("logNormalizeBetween: degenerate set honors both conventions", () => {
  assert.equal(logNormalizeBetween(7, 7, 7), 1, "default: undifferentiated reads heavy");
  assert.equal(logNormalizeBetween(7, 7, 7, { equal: 0 }), 0, "opt-in inverse convention");
  assert.equal(logNormalizeBetween(Number.NaN, 1, 10), 0, "NaN reads 0");
});
