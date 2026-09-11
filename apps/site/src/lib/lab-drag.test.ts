/**
 * Lab direct manipulation — the geometry the chamber drags rest on (#696): the world↔screen
 * mapping, the handle order / omissions, hit priority + slop, and the drag→value arithmetic
 * (deltas divided by the view scale, so the same code is right in the runner's centred frame
 * and in the NO_OFFSET input frame).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  V_ARROW_PX, V_TIP_MIN, HANDLE_R,
  worldToScreen, screenToWorld, velocityTip, labHandles, hitLabHandle, applyLabDrag,
  type LabView, type LabDragOrigin,
} from './lab-drag.ts';

const view: LabView = { scale: 0.73, ox: 212.5, oy: -1370.25 };
const origin: LabDragOrigin = { x: 0, y: 0, vx: 0, vy: 0, bx: 150, by: 0 };
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('worldToScreen / screenToWorld round-trip at a non-trivial scale and offset', () => {
  const [sx, sy] = worldToScreen(view, 3150, 2000);
  near(sx, 3150 * 0.73 + 212.5);
  near(sy, 2000 * 0.73 - 1370.25);
  const [x, y] = screenToWorld(view, sx, sy);
  near(x, 3150);
  near(y, 2000);
});

test('velocityTip: the arrow length when long enough, else a V_TIP_MIN stand-off along v0 (+x at rest)', () => {
  assert.deepEqual(velocityTip(100, 100, 5, 0), [100 + 5 * V_ARROW_PX, 100]);
  assert.deepEqual(velocityTip(100, 100, 0, 0), [100 + V_TIP_MIN, 100]);
  const [tx, ty] = velocityTip(100, 100, 0, 1); // 6 px arrow → pushed out to 16 px, straight down
  near(tx, 100);
  near(ty, 100 + V_TIP_MIN);
});

test('labHandles: hit-priority order velocity → start → body, with the nulls omitted', () => {
  const p0 = { x: 3000, y: 2000, vx: 4, vy: 0 };
  const body = { cx: 3150, cy: 2000 };
  const hs = labHandles(view, p0, body);
  assert.deepEqual(hs.map((h) => h.kind), ['velocity', 'start', 'body']);
  const [sx, sy] = worldToScreen(view, 3000, 2000);
  assert.deepEqual([hs[1]!.sx, hs[1]!.sy, hs[1]!.r], [sx, sy, HANDLE_R.start]);
  assert.deepEqual([hs[0]!.sx, hs[0]!.sy, hs[0]!.r], [sx + 4 * V_ARROW_PX, sy, HANDLE_R.velocity]);
  const [bx, by] = worldToScreen(view, 3150, 2000);
  assert.deepEqual([hs[2]!.sx, hs[2]!.sy, hs[2]!.r], [bx, by, HANDLE_R.body]);
  // a spawn scenario has no tracked particle → only the body; a pair force has no body
  assert.deepEqual(labHandles(view, null, body).map((h) => h.kind), ['body']);
  assert.deepEqual(labHandles(view, p0, null).map((h) => h.kind), ['velocity', 'start']);
  assert.deepEqual(labHandles(view, null, null), []);
});

test('hitLabHandle: first-in-order wins on overlap, slop widens the target, a miss is null', () => {
  const hs = labHandles({ scale: 1, ox: 0, oy: 0 }, { x: 100, y: 100, vx: 2, vy: 0 }, { cx: 100, cy: 100 });
  // the tip sits V_TIP_MIN to the right (a 12 px arrow is shorter than the stand-off)
  assert.equal(hitLabHandle(hs, 100 + V_TIP_MIN, 100)?.kind, 'velocity');
  // the start point's exact centre: the tip is 16 px away (> 7 + 4), the start wins over the body
  assert.equal(hitLabHandle(hs, 100, 100)?.kind, 'start');
  // past the start's 9 + 4 reach but inside the body's 12 + 4 — the body
  assert.equal(hitLabHandle(hs, 100, 100 - 13.5)?.kind, 'body');
  // slop: at 10.5 px the start's 9 + 4 reach catches it; with no slop the start (9) misses and the body (12) takes it
  assert.equal(hitLabHandle(hs, 100, 100 + 10.5)?.kind, 'start');
  assert.equal(hitLabHandle(hs, 100, 100 + 10.5, 0)?.kind, 'body');
  assert.equal(hitLabHandle(hs, 300, 300), null);
});

test('applyLabDrag start/body: Δworld = Δscreen / scale, independent of the origin magnitude, rounded to 1 px', () => {
  const from = { sx: 400, sy: 300 }, to = { sx: 440, sy: 325 };
  const s = applyLabDrag('start', view, from, to, origin);
  assert.deepEqual(s, { x: Math.round(40 / 0.73), y: Math.round(25 / 0.73) });
  // the same screen delta from a translated origin (the runner's centred frame) moves by the same amount
  const far = applyLabDrag('start', view, from, to, { ...origin, x: 3000, y: 2000 });
  assert.deepEqual(far, { x: 3000 + Math.round(40 / 0.73), y: 2000 + Math.round(25 / 0.73) });
  const b = applyLabDrag('body', view, from, { sx: 380, sy: 300 }, origin);
  assert.deepEqual(b, { bx: 150 + Math.round(-20 / 0.73), by: 0 });
  assert.ok(Number.isInteger(s.x) && Number.isInteger(s.y) && Number.isInteger(b.bx));
});

test('applyLabDrag velocity: Δv = Δscreen / V_ARROW_PX, rounded to 0.1 px/f', () => {
  const v = applyLabDrag('velocity', view, { sx: 100, sy: 100 }, { sx: 130, sy: 100 }, origin);
  assert.deepEqual(v, { vx: 5, vy: 0 });
  const v2 = applyLabDrag('velocity', view, { sx: 100, sy: 100 }, { sx: 101, sy: 88 }, { ...origin, vx: 2.5, vy: 1 });
  assert.deepEqual(v2, { vx: 2.7, vy: -1 }); // 2.5 + 1/6 = 2.667 → 2.7 ; 1 - 12/6 = -1
  // the velocity mapping ignores the view scale (screen px per px/frame is fixed)
  assert.deepEqual(applyLabDrag('velocity', { scale: 5, ox: 0, oy: 0 }, { sx: 0, sy: 0 }, { sx: 30, sy: 0 }, origin), { vx: 5, vy: 0 });
});

test('a zero-motion drag returns the origin unchanged', () => {
  const p = { sx: 12, sy: 34 };
  assert.deepEqual(applyLabDrag('start', view, p, p, origin), { x: 0, y: 0 });
  assert.deepEqual(applyLabDrag('velocity', view, p, p, { ...origin, vx: 1.3, vy: -0.4 }), { vx: 1.3, vy: -0.4 });
  assert.deepEqual(applyLabDrag('body', view, p, p, origin), { bx: 150, by: 0 });
});
