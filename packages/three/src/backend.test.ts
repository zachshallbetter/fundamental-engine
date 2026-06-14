/**
 * `threeBackend` GPU-buffer hygiene: the overlay's line/triangle attributes are persistent,
 * growable `DynamicDrawUsage` buffers written in place every frame — NOT four fresh Float32Arrays
 * + BufferAttributes per overlay frame (which orphaned the prior GPU buffers for the GC and forced
 * a full re-upload). These tests pin the reuse-in-steady-state and grow-on-demand behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DynamicDrawUsage, type BufferAttribute, type BufferGeometry, type LineSegments } from 'three';
import { threeBackend } from './backend.ts';
import { PlaneProjection } from './project.ts';

const stroke = { r: 255, g: 255, b: 255, alpha: 1 };
const lineGeomOf = (b: ReturnType<typeof threeBackend>): BufferGeometry =>
  (b.object.children[0] as LineSegments).geometry;

test('flush reuses the same position BufferAttribute across frames (no per-frame realloc)', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const geom = lineGeomOf(backend);

  backend.segments([0, 0, 10, 10, 20, 20, 30, 30], stroke); // two segments
  backend.clear(); // clear() finalizes the frame then resets the accumulators
  const attr1 = geom.getAttribute('position');
  assert.ok(geom.drawRange.count > 0, 'frame 1 drew something');
  assert.equal((attr1 as BufferAttribute).usage, DynamicDrawUsage, 'buffer marked dynamic');

  backend.segments([0, 0, 5, 5], stroke); // fewer segments → must reuse the existing buffer
  backend.clear();
  const attr2 = geom.getAttribute('position');
  assert.equal(attr2, attr1, 'same attribute object reused — no orphaned GPU buffer');
  assert.equal(geom.drawRange.count, 2, 'draw range bounds the live segment, ignoring the stale tail');
});

test('flush grows the buffer only when a frame needs more room', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const geom = lineGeomOf(backend);

  backend.segments([0, 0, 1, 1], stroke);
  backend.clear();
  const small = geom.getAttribute('position');

  const big: number[] = [];
  for (let i = 0; i < 400; i++) big.push(i, i, i + 1, i + 1); // 400 segments → 2400 floats
  backend.segments(big, stroke);
  backend.clear();
  const grown = geom.getAttribute('position');

  assert.notEqual(grown, small, 'buffer reallocated to fit the larger frame');
  assert.equal((grown as BufferAttribute).usage, DynamicDrawUsage, 'grown buffer stays dynamic');
  assert.ok((grown.array as Float32Array).length >= 2400, 'capacity covers the larger frame');
  assert.equal(geom.drawRange.count, 800, 'draw range = 2400 floats / 3');
});
