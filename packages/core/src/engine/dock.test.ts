/**
 * Dock decision core — element capture (§22.3). The pure trigger / collapse / transform math behind a
 * `[data-move][data-dock]` element docking into a sink; the DOM writes + a11y + events live in
 * field.ts and are exercised on the live site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withinCapture, stepDock, dockTransform } from './dock.ts';

test('withinCapture is true only inside the sink capture radius', () => {
  const sink = { cx: 100, cy: 100, absorbR: 50 };
  assert.equal(withinCapture({ x: 100, y: 100 }, sink), true, 'at the core');
  assert.equal(withinCapture({ x: 140, y: 100 }, sink), true, '40px < 50');
  assert.equal(withinCapture({ x: 160, y: 100 }, sink), false, '60px > 50');
  assert.equal(withinCapture({ x: 100, y: 151 }, sink), false, 'just outside');
});

test('stepDock eases toward the target and snaps at the ends', () => {
  assert.equal(stepDock(0, 0), 0, 'free stays free');
  assert.ok(stepDock(0, 1) > 0 && stepDock(0, 1) < 1, 'docks partway in one step');
  // converges to 1 when docking
  let p = 0;
  for (let i = 0; i < 100; i++) p = stepDock(p, 1);
  assert.equal(p, 1, 'fully docked');
  // converges to 0 when releasing
  for (let i = 0; i < 100; i++) p = stepDock(p, 0);
  assert.equal(p, 0, 'fully restored');
});

test('dockTransform collapses the element toward the sink core as progress → 1', () => {
  const home = { x: 0, y: 0 };
  const offset = { x: 20, y: 0 }; // element currently 20px right of its slot
  const sink = { x: 200, y: 0 };

  const free = dockTransform(home, offset, sink, 0);
  assert.deepEqual({ tx: free.tx, ty: free.ty, scale: free.scale }, { tx: 20, ty: 0, scale: 1 }, 'progress 0 → unchanged, full size');

  const docked = dockTransform(home, offset, sink, 1);
  assert.equal(docked.tx, 200, 'progress 1 → element centre sits at the sink');
  assert.equal(docked.ty, 0);
  assert.equal(docked.scale, 0, 'collapsed to nothing');
  assert.equal(docked.opacity, 0, 'and faded out');

  const mid = dockTransform(home, offset, sink, 0.5);
  assert.ok(mid.tx > 20 && mid.tx < 200, 'halfway translates partway to the sink');
  assert.equal(mid.scale, 0.5, 'and is half-scaled');
});
