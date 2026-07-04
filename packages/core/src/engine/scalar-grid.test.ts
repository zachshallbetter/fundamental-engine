import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScalarGridImpl } from './scalar-grid.ts';

const near = (a: number, b: number, tol = 1e-4): boolean => Math.abs(a - b) < tol;

test('deposit then sample returns the value at the cell node', () => {
  const g = new ScalarGridImpl(320, 320, 'diffuse', 32);
  g.deposit(64, 64, 5); // lands on the node at (cell 2, cell 2)
  assert.ok(near(g.sample(64, 64), 5));
  assert.ok(near(g.sample(0, 0), 0)); // elsewhere still empty
});

test('sample is bilinear between nodes', () => {
  const g = new ScalarGridImpl(320, 320, 'diffuse', 32);
  g.deposit(64, 64, 4); // node A
  g.deposit(96, 64, 8); // node B (one cell to the right)
  // halfway between A and B → average of the two node values
  assert.ok(near(g.sample(80, 64), 6));
});

test('gradient points up-slope toward higher concentration', () => {
  const g = new ScalarGridImpl(320, 320, 'diffuse', 32);
  g.deposit(160, 160, 10); // a peak in the middle
  // just to the right of the peak, φ increases toward the peak (−x) → grad.x < 0
  const grad = g.gradient(192, 160);
  assert.ok(grad.x < 0);
  assert.ok(near(grad.y, 0, 1e-3)); // symmetric in y
});

test('diffusion spreads a spike and conserves with zero decay', () => {
  const g = new ScalarGridImpl(160, 160, 'diffuse', 32);
  g.deposit(64, 64, 12);
  const before = g.sample(64, 64);
  g.stepDiffuse(0.2, 0); // no decay → mass conserved
  assert.ok(g.sample(64, 64) < before); // peak drops
  assert.ok(g.sample(96, 64) > 0); // neighbour gains
});

test('diffusion decay bleeds the field toward zero', () => {
  const g = new ScalarGridImpl(160, 160, 'diffuse', 32);
  g.deposit(64, 64, 12);
  g.stepDiffuse(0, 0.5); // pure decay, no spread
  assert.ok(near(g.sample(64, 64), 6)); // halved
});

test('wave mode propagates a disturbance to neighbours', () => {
  const g = new ScalarGridImpl(160, 160, 'wave', 32);
  g.deposit(64, 64, 10);
  assert.ok(near(g.sample(96, 64), 0)); // neighbour starts quiet
  g.stepWave();
  assert.ok(g.sample(96, 64) > 0); // the disturbance has spread
});

test('step() dispatches on the grid mode', () => {
  const diff = new ScalarGridImpl(160, 160, 'diffuse', 32);
  diff.deposit(64, 64, 10);
  diff.step();
  assert.ok(diff.sample(64, 64) < 10); // diffused away from the peak
  const wave = new ScalarGridImpl(160, 160, 'wave', 32);
  wave.deposit(64, 64, 10);
  wave.step();
  assert.ok(wave.sample(96, 64) > 0); // propagated
});

test('resize rebuilds (and clears) the field', () => {
  const g = new ScalarGridImpl(160, 160, 'diffuse', 32);
  g.deposit(64, 64, 9);
  g.resize(320, 240);
  assert.equal(g.sample(64, 64), 0); // rebuilt empty
  g.deposit(64, 64, 3);
  assert.ok(near(g.sample(64, 64), 3)); // usable at the new size
});

test("'memory' mode retains a deposit far longer than diffuse (slow decay, barely blurs)", () => {
  const mem = new ScalarGridImpl(320, 320, 'memory', 32);
  const dif = new ScalarGridImpl(320, 320, 'diffuse', 32);
  mem.deposit(160, 160, 10);
  dif.deposit(160, 160, 10);
  for (let i = 0; i < 40; i++) {
    mem.step();
    dif.step();
  }
  // both fade, but memory keeps several times more of the worn-in mark (slow decay)
  assert.ok(
    mem.sample(160, 160) > dif.sample(160, 160) * 3,
    `memory persists far longer: ${mem.sample(160, 160).toFixed(3)} vs ${dif.sample(160, 160).toFixed(3)}`,
  );
});
