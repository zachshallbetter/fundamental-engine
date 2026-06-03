import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrateOffset, anchorForce, elementMass, type ElementOffset } from './agents.ts';

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
