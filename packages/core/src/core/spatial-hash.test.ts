import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from './spatial-hash.ts';

type P = { x: number; y: number };

test('near returns points within the radius, excludes those outside', () => {
  const h = new SpatialHash<P>(50);
  const a = { x: 0, y: 0 };
  const b = { x: 30, y: 0 };
  const c = { x: 200, y: 0 };
  h.rebuild([a, b, c]);
  const near = h.near(0, 0, 40);
  assert.ok(near.includes(a));
  assert.ok(near.includes(b));
  assert.ok(!near.includes(c));
});

test('rebuild clears previous contents', () => {
  const h = new SpatialHash<P>(50);
  h.rebuild([{ x: 0, y: 0 }]);
  h.rebuild([{ x: 500, y: 500 }]);
  assert.equal(h.near(0, 0, 40).length, 0);
});

test('works across negative coordinates', () => {
  const h = new SpatialHash<P>(50);
  const a = { x: -120, y: -120 };
  h.rebuild([a, { x: 300, y: 300 }]);
  assert.deepEqual(h.near(-120, -120, 10), [a]);
});

test('3D near filters by true distance (z lane), planar bins', () => {
  type P3 = { x: number; y: number; z?: number };
  const h = new SpatialHash<P3>(50);
  const near = { x: 0, y: 0, z: 5 };
  const far = { x: 0, y: 0, z: 100 }; // same (x,y) cell, out of range in z
  h.rebuild([near, far]);
  const hit = h.near(0, 0, 20, 0);
  assert.ok(hit.includes(near));
  assert.ok(!hit.includes(far));
});

// Equivalence pin for the bin-pooling refactor (#991): rebuilding repeatedly (which now recycles
// bin arrays via the free-list instead of allocating fresh ones) must return byte-identical
// neighbour sets to a naive brute-force scan, across many frames with churning contents. This is
// the guard that the pooling change did not alter query behaviour.
test('bin pooling: query results identical to brute force across many rebuilds', () => {
  // deterministic LCG so the test is reproducible
  let s = 0x1234abcd >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
  const W = 800, H = 600, R = 70;
  const h = new SpatialHash<P>(64);

  const brute = (pts: P[], x: number, y: number, r: number): P[] => {
    const r2 = r * r;
    return pts.filter((p) => { const dx = p.x - x, dy = p.y - y; return dx * dx + dy * dy <= r2; });
  };
  const sortKey = (p: P) => p.x * 100000 + p.y;
  const norm = (arr: P[]) => [...arr].sort((a, b) => sortKey(a) - sortKey(b));

  for (let frame = 0; frame < 60; frame++) {
    // vary the population size frame to frame so cell occupancy churns (exercises the free-list)
    const n = 50 + Math.floor(rnd() * 400);
    const pts: P[] = [];
    for (let i = 0; i < n; i++) pts.push({ x: rnd() * W, y: rnd() * H });
    h.rebuild(pts);
    // probe several query points, including edges/negatives
    for (const [qx, qy] of [[400, 300], [0, 0], [W, H], [-40, 200], [123, 456]] as const) {
      const got = norm(h.near(qx, qy, R));
      const exp = norm(brute(pts, qx, qy, R));
      assert.deepEqual(got, exp, `frame ${frame} @ (${qx},${qy})`);
    }
  }
});
