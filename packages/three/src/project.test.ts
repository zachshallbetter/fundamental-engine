/**
 * `PlaneProjection` — the 2D↔3D seam. Pins the round-trip (`toWorld` then `toField` recovers the
 * field pixel), the y-flip (screen-down → world-up), centering, and the `heat`-driven z relief.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PlaneProjection } from './project.ts';

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

test('toField inverts toWorld (centered)', () => {
  const p = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  for (const [x, y] of [[0, 0], [500, 300], [1000, 600], [137, 421]] as const) {
    const w = p.toWorld(x, y, 0, 0);
    const f = p.toField(w);
    assert.ok(approx(f.x, x), `x round-trips at (${x},${y}) → ${f.x}`);
    assert.ok(approx(f.y, y), `y round-trips at (${x},${y}) → ${f.y}`);
  }
});

test('center maps the field middle to the world origin; y flips', () => {
  const p = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const mid = p.toWorld(500, 300, 0, 0);
  assert.ok(approx(mid.x, 0) && approx(mid.y, 0), 'field center → origin');

  const top = p.toWorld(500, 0, 0, 0); // screen top
  const bottom = p.toWorld(500, 600, 0, 0); // screen bottom
  assert.ok(top.y > 0, 'screen-top maps to positive world-y (up)');
  assert.ok(bottom.y < 0, 'screen-bottom maps to negative world-y (down)');
});

test('relief lifts z by heat; flat when relief is 0', () => {
  const lifted = new PlaneProjection({ relief: 2 });
  assert.ok(approx(lifted.toWorld(0, 0, 0, 0).z, 0), 'cold matter sits on the plane');
  assert.ok(approx(lifted.toWorld(0, 0, 1, 0).z, 2), 'hot matter lifts to relief');
  assert.ok(approx(lifted.toWorld(0, 0, 0.5, 0).z, 1), 'z is linear in heat');

  const flat = new PlaneProjection({ relief: 0 });
  assert.ok(approx(flat.toWorld(0, 0, 1, 0).z, 0), 'relief 0 keeps the field flat');
});

test('uncentered places field (0,0) at the world origin', () => {
  const p = new PlaneProjection({ width: 1000, height: 600, scale: 0.01, center: false });
  const origin = p.toWorld(0, 0, 0, 0);
  assert.ok(approx(origin.x, 0) && approx(origin.y, 0), 'field (0,0) → origin');
  const f = p.toField(new Vector3(2, -1.5, 0));
  assert.ok(approx(f.x, 200) && approx(f.y, 150), 'world → field inverts uncentered');
});
