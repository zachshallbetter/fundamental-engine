/**
 * The projection seam. `PlaneProjection` pins the round-trip, the y-flip, centering, and the
 * `heat`-driven relief (engine z ignored). `VolumeProjection` pins that the engine's real depth lane
 * maps onto a world depth range — the difference between "field on a plane" and "field in a volume".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PlaneProjection, VolumeProjection } from './project.ts';

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

test('PlaneProjection: toField inverts toWorld (centered)', () => {
  const p = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  for (const [x, y] of [[0, 0], [500, 300], [1000, 600], [137, 421]] as const) {
    const w = p.toWorld(x, y, 0, 0, 0);
    const f = p.toField(w);
    assert.ok(approx(f.x, x) && approx(f.y, y), `(${x},${y}) round-trips`);
  }
});

test('PlaneProjection: center maps the field middle to the origin; y flips', () => {
  const p = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const mid = p.toWorld(500, 300, 0, 0, 0);
  assert.ok(approx(mid.x, 0) && approx(mid.y, 0), 'field center → origin');
  assert.ok(p.toWorld(500, 0, 0, 0, 0).y > 0, 'screen-top → +world-y');
  assert.ok(p.toWorld(500, 600, 0, 0, 0).y < 0, 'screen-bottom → -world-y');
});

test('PlaneProjection: relief lifts z by heat and ignores the engine z', () => {
  const lifted = new PlaneProjection({ relief: 2 });
  assert.ok(approx(lifted.toWorld(0, 0, 0, 0, 0).z, 0), 'cold matter sits on the plane');
  assert.ok(approx(lifted.toWorld(0, 0, 0, 1, 0).z, 2), 'hot matter lifts to relief');
  // a non-zero engine z must NOT move a PlaneProjection — relief is heat-only
  assert.ok(approx(lifted.toWorld(0, 0, 999, 0, 0).z, 0), 'engine z is ignored by the plane');
  assert.ok(approx(new PlaneProjection({ relief: 0 }).toWorld(0, 0, 0, 1, 0).z, 0), 'relief 0 stays flat');
});

test('VolumeProjection: maps the engine z lane onto a world depth range', () => {
  const v = new VolumeProjection({ width: 1000, height: 600, scale: 0.01, depth: 300 });
  // x/y behave like the plane
  const mid = v.toWorld(500, 300, 0, 0, 0);
  assert.ok(approx(mid.x, 0) && approx(mid.y, 0) && approx(mid.z, 0), 'plane z=0 sits at world origin');
  // engine z drives world z (depthScale defaults to scale → 300 * 0.01 = 3)
  assert.ok(approx(v.toWorld(500, 300, 300, 0, 0).z, 3), 'z=depth maps to depth*scale');
  assert.ok(approx(v.toWorld(500, 300, 150, 0, 0).z, 1.5), 'z is linear');
  // heat does NOT move z in a volume (real depth owns the axis)
  assert.ok(approx(v.toWorld(0, 0, 0, 1, 0).z, 0), 'heat does not lift in a volume');
});

test('VolumeProjection: centerZ puts the page plane at world-z 0 with depth both ways', () => {
  const v = new VolumeProjection({ depth: 300, scale: 0.01, centerZ: true });
  assert.ok(v.toWorld(0, 0, 0, 0, 0).z < 0, 'plane (z=0) sits behind center when centered');
  assert.ok(v.toWorld(0, 0, 300, 0, 0).z > 0, 'far depth sits in front of center');
  assert.ok(approx(v.toWorld(0, 0, 150, 0, 0).z, 0), 'mid-depth sits at world-z 0');
});

test('VolumeProjection: toField inverts x/y (z ignored)', () => {
  const v = new VolumeProjection({ width: 1000, height: 600, scale: 0.01, center: false });
  const f = v.toField(new Vector3(2, -1.5, 7));
  assert.ok(approx(f.x, 200) && approx(f.y, 150), 'world → field inverts, depth ignored');
});
