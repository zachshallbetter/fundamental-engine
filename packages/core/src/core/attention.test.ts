import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionMuls, allocateAttention } from './attention.ts';

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
// total strength after allocation, for the conservation check
const totalEff = (bodies: { strength: number; on: boolean }[], muls: number[]) =>
  bodies.reduce((acc, b, i) => acc + b.strength * muls[i]!, 0);

test('rest-neutral: nothing engaged → every multiplier is exactly 1', () => {
  const bodies = [
    { strength: 1, on: false },
    { strength: 2, on: false },
    { strength: 0.5, on: false },
  ];
  assert.deepEqual(attentionMuls(bodies), [1, 1, 1]);
});

test('engaging one body boosts it and starves the others', () => {
  const bodies = [
    { strength: 1, on: true },
    { strength: 1, on: false },
    { strength: 1, on: false },
  ];
  const m = attentionMuls(bodies);
  assert.ok(m[0]! > 1, 'engaged body gains');
  assert.ok(m[1]! < 1 && m[2]! < 1, 'idle bodies are starved');
  assert.equal(m[1], m[2], 'equal idle bodies share equally');
});

test('total strength is conserved (Σ Sᵢ·mulᵢ = Σ Sᵢ) within the clamp', () => {
  const bodies = [
    { strength: 1.5, on: true },
    { strength: 0.8, on: false },
    { strength: 2.0, on: false },
    { strength: 1.0, on: true },
  ];
  const m = attentionMuls(bodies);
  const before = sum(bodies.map((b) => b.strength));
  const after = totalEff(bodies, m);
  assert.ok(Math.abs(after - before) < 1e-9, `conserved: ${after} ≈ ${before}`);
});

test('cannot emphasise two things at once: a second engagement splits the boost', () => {
  const one = attentionMuls([
    { strength: 1, on: true },
    { strength: 1, on: false },
    { strength: 1, on: false },
  ]);
  const two = attentionMuls([
    { strength: 1, on: true },
    { strength: 1, on: true },
    { strength: 1, on: false },
  ]);
  // the first body is engaged in both; with a rival also engaged it gets less.
  assert.ok(two[0]! < one[0]!, 'engaging a rival reduces the first body’s share');
});

test('clamp bounds are respected for an extreme demand spread', () => {
  // one tiny idle body among many strong engaged ones → idle would dive below the floor
  const bodies = [
    { strength: 0.01, on: false },
    ...Array.from({ length: 20 }, () => ({ strength: 5, on: true })),
  ];
  const m = attentionMuls(bodies, { lo: 0.25, hi: 3 });
  for (const v of m) assert.ok(v >= 0.25 - 1e-9 && v <= 3 + 1e-9, `within clamp: ${v}`);
});

test('degenerate inputs stay neutral (no NaN)', () => {
  assert.deepEqual(attentionMuls([]), []);
  assert.deepEqual(attentionMuls([{ strength: 0, on: true }]), [1]);
  assert.deepEqual(attentionMuls([{ strength: -3, on: false }]), [1]);
});

test('β scales how hard an engaged body competes', () => {
  const mk = (beta: number) =>
    attentionMuls(
      [
        { strength: 1, on: true },
        { strength: 1, on: false },
      ],
      { beta },
    );
  assert.ok(mk(4)[0]! > mk(2)[0]!, 'higher β → bigger boost for the engaged body');
});

// ── allocateAttention — the conserved water-filling allocation (#296) ──────────

const items = (...us: number[]) => us.map((urgency) => ({ urgency }));
const close = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} ≈ ${b}`);

test('allocateAttention: Σw === budget exactly across urgency shapes', () => {
  const cases: { us: number[]; budget: number }[] = [
    { us: [1, 1, 1, 1], budget: 4 * 0.42 }, // uniform — the inbox's per-item budget
    { us: [10, 1, 0.5, 0.25, 0.1], budget: 2.1 }, // skewed — the dominant item saturates
    { us: [0.7], budget: 0.42 }, // single item
    { us: [3, 0, 2, 0, 1], budget: 2 }, // zeros among positives
    { us: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4], budget: 5.5 }, // most items forced to the cap
  ];
  for (const { us, budget } of cases) {
    const w = allocateAttention(items(...us), budget);
    close(sum(w), budget, `Σw = ${sum(w)} ≈ ${budget} for [${us}]`);
    for (const v of w) assert.ok(v >= 0 && v <= 1 + 1e-9 && Number.isFinite(v), `0 ≤ ${v} ≤ cap`);
  }
});

test('allocateAttention: capped excess re-flows over the rest (water-filling)', () => {
  // 3 × 0.42 = 1.26; the dominant ask saturates at 1 and the freed 0.26 splits evenly
  const w = allocateAttention(items(10, 1, 1), 1.26);
  assert.equal(w[0], 1, 'dominant item saturates at the cap');
  close(w[1]!, 0.13);
  close(w[2]!, 0.13);
  close(sum(w), 1.26);
});

test('allocateAttention: budget past the ceiling saturates every weight at cap', () => {
  const w = allocateAttention(items(5, 1, 0.2), 10);
  assert.deepEqual(w, [1, 1, 1]);
  const capped = allocateAttention(items(5, 1, 0.2), 10, { cap: 0.5 });
  assert.deepEqual(capped, [0.5, 0.5, 0.5]);
});

test('allocateAttention: budget 0 → all 0; empty input → []', () => {
  assert.deepEqual(allocateAttention(items(1, 2, 3), 0), [0, 0, 0]);
  assert.deepEqual(allocateAttention([], 5), []);
});

test('allocateAttention: zero/negative/non-finite urgencies get 0 — budget flows only where there is demand', () => {
  const w = allocateAttention(items(2, 0, -3, NaN), 1.2);
  assert.equal(w[1], 0);
  assert.equal(w[2], 0);
  assert.equal(w[3], 0);
  close(sum(w), 1, 'only the one demanding item is filled (to the cap)');
  // all-zero urgencies allocate nothing — the inbox's exact degenerate behavior
  assert.deepEqual(allocateAttention(items(0, 0, 0), 1.26), [0, 0, 0]);
});

test('allocateAttention: pins take exactly cap off the top; the rest still sums to budget − pins', () => {
  const list = [
    { urgency: 0.2, pinned: true },
    { urgency: 0.9 },
    { urgency: 0.4 },
    { urgency: 0.1, pinned: true },
    { urgency: 0.6 },
  ];
  const budget = 5 * 0.42; // 2.1, the inbox's shape: budget − pinnedCount water-fills the unpinned
  const w = allocateAttention(list, budget);
  assert.equal(w[0], 1, 'pinned holds cap regardless of urgency');
  assert.equal(w[3], 1, 'pinned holds cap regardless of urgency');
  close(w[1]! + w[2]! + w[4]!, budget - 2, 'unpinned share = budget − pinnedCount × cap');
  close(sum(w), budget);
  // pins past the budget: the floor at 0 holds and nothing goes negative
  const over = allocateAttention(
    [{ urgency: 1, pinned: true }, { urgency: 1, pinned: true }, { urgency: 1 }],
    1,
  );
  assert.deepEqual(over, [1, 1, 0]);
});

test('allocateAttention: deterministic — the same input twice is identical', () => {
  const list = [
    { urgency: 0.83, pinned: true },
    { urgency: 0.41 },
    { urgency: 7 },
    { urgency: 0 },
    { urgency: 0.41 },
  ];
  assert.deepEqual(allocateAttention(list, 2.1), allocateAttention(list, 2.1));
});
