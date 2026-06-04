import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spillover } from './causality.ts';

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

test('no body over threshold → no transfer', () => {
  const d = spillover([
    { d: 0.3, cx: 0, cy: 0 },
    { d: 0.4, cx: 100, cy: 0 },
  ]);
  assert.deepEqual(d, [0, 0]);
});

test('a saturated body spills to a near neighbour, donating what it gives', () => {
  const d = spillover(
    [
      { d: 0.9, cx: 0, cy: 0 }, // saturated
      { d: 0.1, cx: 100, cy: 0 }, // near, idle
    ],
    { threshold: 0.55, kappa: 0.6, falloff: 320 },
  );
  assert.ok(d[1]! > 0, 'neighbour receives');
  assert.ok(d[0]! < 0, 'saturated body donates');
  assert.ok(Math.abs(d[0]! + d[1]!) < 1e-9, 'conserved between the pair');
});

test('transfer is conserved across the whole set (ΣΔ = 0)', () => {
  const d = spillover([
    { d: 0.95, cx: 0, cy: 0 },
    { d: 0.7, cx: 120, cy: 0 },
    { d: 0.2, cx: 240, cy: 0 },
    { d: 0.1, cx: 90, cy: 120 },
  ]);
  assert.ok(Math.abs(sum(d)) < 1e-9, `conserved: Σ = ${sum(d)}`);
});

test('proximity-weighted: a closer neighbour receives more than a far one', () => {
  const d = spillover(
    [
      { d: 0.9, cx: 0, cy: 0 }, // source
      { d: 0, cx: 80, cy: 0 }, // near
      { d: 0, cx: 300, cy: 0 }, // far (within falloff but weaker)
    ],
    { falloff: 320 },
  );
  assert.ok(d[1]! > d[2]!, 'the closer neighbour gets the larger share');
});

test('beyond falloff there is no transfer', () => {
  const d = spillover(
    [
      { d: 0.9, cx: 0, cy: 0 },
      { d: 0, cx: 1000, cy: 0 }, // out of reach
    ],
    { falloff: 320 },
  );
  assert.deepEqual(d, [0, 0]);
});

test('a larger excess spills more', () => {
  const small = spillover([
    { d: 0.6, cx: 0, cy: 0 },
    { d: 0, cx: 100, cy: 0 },
  ]);
  const big = spillover([
    { d: 0.95, cx: 0, cy: 0 },
    { d: 0, cx: 100, cy: 0 },
  ]);
  assert.ok(big[1]! > small[1]!, 'more excess → more spillover to the neighbour');
});

test('degenerate inputs are safe', () => {
  assert.deepEqual(spillover([]), []);
  assert.deepEqual(spillover([{ d: 0.9, cx: 0, cy: 0 }]), [0]); // nothing to spill to
});
