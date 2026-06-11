/**
 * `ParticlePool.write` — the particle bridge's conversion step. Pins that a stride-4
 * `[x, y, heat, size]` staging buffer (the shape `FieldHandle.readParticles` fills) lands on the
 * geometry: position via the projection, `aHeat`/`aSize` per vertex, draw range = live count, and
 * truncation to capacity. No WebGL context needed — `BufferGeometry` is pure data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BufferAttribute, InterleavedBufferAttribute } from 'three';
import { PlaneProjection } from './project.ts';
import { ParticlePool } from './particles.ts';

const arr = (a: BufferAttribute | InterleavedBufferAttribute): Float32Array => a.array as Float32Array;

test('write maps the staging buffer onto position / aHeat / aSize', () => {
  const projection = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const pool = new ParticlePool({ capacity: 4, projection });

  // two particles: a centered cold one, and a hot offset one
  pool.staging.set([500, 300, 0, 2, /* p1 */ 600, 300, 1, 3 /* p2 */], 0);
  const n = pool.write(2);
  assert.equal(n, 2, 'returns the written count');
  assert.equal(pool.size, 2);
  assert.equal(pool.geometry.drawRange.count, 2, 'draw range tracks the live count');

  const pos = arr(pool.geometry.getAttribute('position'));
  const expected = projection.toWorld(500, 300, 0, 2);
  assert.ok(Math.abs(pos[0]! - expected.x) < 1e-6 && Math.abs(pos[1]! - expected.y) < 1e-6, 'p1 at field center');

  const heat = arr(pool.geometry.getAttribute('aHeat'));
  const size = arr(pool.geometry.getAttribute('aSize'));
  assert.equal(heat[0], 0);
  assert.equal(heat[1], 1, 'p2 heat carried through');
  assert.equal(size[0], 2);
  assert.equal(size[1], 3, 'p2 size carried through');

  pool.dispose();
});

test('write truncates to the pool capacity', () => {
  const pool = new ParticlePool({ capacity: 2, projection: new PlaneProjection() });
  // ask to write 5 though the buffer only holds 2
  const written = pool.write(5);
  assert.equal(written, 2, 'never writes past capacity');
  assert.equal(pool.geometry.drawRange.count, 2);
  pool.dispose();
});
