import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionMuls } from './attention.ts';

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
