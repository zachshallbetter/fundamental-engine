import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrateOffset, anchorForce, elementMass, repelForce, densityPush, type ElementOffset } from './agents.ts';

test('integrateOffset advances offset under force, with mass + damping', () => {
  const o: ElementOffset = { x: 0, y: 0, vx: 0, vy: 0 };
  integrateOffset(o, 10, 0, 1); // f=10, m=1, friction 0.9 → vx=9, x=9
  assert.ok(Math.abs(o.vx - 9) < 1e-9);
  assert.ok(Math.abs(o.x - 9) < 1e-9);
});

test('heavier elements move less under the same force', () => {
  const light: ElementOffset = { x: 0, y: 0, vx: 0, vy: 0 };
  const heavy: ElementOffset = { x: 0, y: 0, vx: 0, vy: 0 };
  integrateOffset(light, 10, 0, 1);
  integrateOffset(heavy, 10, 0, 5);
  assert.ok(Math.abs(heavy.x) < Math.abs(light.x));
});

test('offset is clamped to maxOffset', () => {
  const o: ElementOffset = { x: 0, y: 0, vx: 0, vy: 0 };
  integrateOffset(o, 1000, 0, 1, 0.9, 80);
  assert.ok(Math.hypot(o.x, o.y) <= 80 + 1e-6);
});

test('anchorForce pulls back toward home', () => {
  assert.deepEqual(anchorForce({ x: 100, y: -50, vx: 0, vy: 0 }, 0.02), { x: -2, y: 1 });
});

test('elementMass scales with area, clamped', () => {
  assert.equal(elementMass(0), 0.6);
  assert.equal(elementMass(1e9), 6);
});

test('repelForce pushes away from other elements (Concept 3)', () => {
  // one neighbour to the right → pushed left (−x)
  const f = repelForce({ x: 0, y: 0 }, [{ x: 100, y: 0 }]);
  assert.ok(f.x < 0);
  assert.ok(Math.abs(f.y) < 1e-9);
  // symmetric neighbours left and right cancel on x
  const sym = repelForce({ x: 0, y: 0 }, [{ x: 100, y: 0 }, { x: -100, y: 0 }]);
  assert.ok(Math.abs(sym.x) < 1e-9);
  // a closer neighbour pushes harder than a far one
  const near = repelForce({ x: 0, y: 0 }, [{ x: 40, y: 0 }]);
  assert.ok(Math.abs(near.x) > Math.abs(f.x));
});

test('repelForce is finite even at full overlap (softened)', () => {
  const f = repelForce({ x: 10, y: 10 }, [{ x: 10, y: 10 }]);
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
  assert.equal(f.x, 0); // zero separation → zero direction, no blowup
  assert.equal(f.y, 0);
});

test('densityPush points down the density gradient (Concept 3)', () => {
  // density rises with x → gradient is +x → the push is −x (toward emptier space)
  const ramp = (x: number): number => x;
  const f = densityPush(ramp, 50, 50, 10, 1);
  assert.ok(f.x < 0);
  assert.ok(Math.abs(f.y) < 1e-9);
  // a flat field exerts no pressure (±0 — compare by magnitude, not Object.is)
  const flat = densityPush(() => 3, 50, 50);
  assert.ok(Math.abs(flat.x) < 1e-9);
  assert.ok(Math.abs(flat.y) < 1e-9);
});
