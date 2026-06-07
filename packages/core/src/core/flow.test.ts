/**
 * Flow control (controlled, dynamically-targeted field lines). The render application lives in
 * field.ts (canvas); the pure pull math is tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowBias, makeFlowFocus, FLOW_DEFAULT_RADIUS, FLOW_DEFAULT_STRENGTH } from './flow.ts';

test('makeFlowFocus applies defaults and guards radius', () => {
  assert.deepEqual(makeFlowFocus(10, 20), { x: 10, y: 20, strength: FLOW_DEFAULT_STRENGTH, radius: FLOW_DEFAULT_RADIUS });
  assert.equal(makeFlowFocus(0, 0, { radius: 0 }).radius, FLOW_DEFAULT_RADIUS, 'non-positive radius falls back');
  assert.equal(makeFlowFocus(0, 0, { strength: 2, radius: 100 }).strength, 2);
});

test('flowBias points toward the focus and falls off to zero at the radius', () => {
  const f = makeFlowFocus(100, 0, { strength: 1, radius: 200 });
  const near = flowBias(0, 0, f, 1); // distance 100, halfway → fall = 0.5
  assert.ok(near.x > 0 && Math.abs(near.y) < 1e-9, 'pulls toward +x');
  assert.ok(Math.abs(near.x - 0.5) < 1e-9, 'linear falloff at half radius');
  // closer → stronger
  const closer = flowBias(50, 0, f, 1); // distance 50 → fall 0.75
  assert.ok(closer.x > near.x);
});

test('flowBias is zero outside the radius, on the radius, and at the focus', () => {
  const f = makeFlowFocus(0, 0, { strength: 1, radius: 100 });
  assert.deepEqual(flowBias(200, 0, f), { x: 0, y: 0 }, 'outside');
  assert.deepEqual(flowBias(100, 0, f), { x: 0, y: 0 }, 'exactly on the radius');
  assert.deepEqual(flowBias(0, 0, f), { x: 0, y: 0 }, 'at the focus (no direction)');
});

test('strength scales the pull; gain scales the application', () => {
  const weak = makeFlowFocus(100, 0, { strength: 0.5, radius: 200 });
  const strong = makeFlowFocus(100, 0, { strength: 1.5, radius: 200 });
  assert.ok(flowBias(0, 0, strong, 1).x > flowBias(0, 0, weak, 1).x);
  assert.ok(flowBias(0, 0, weak, 1).x > flowBias(0, 0, weak, 0.5).x, 'gain scales');
});
