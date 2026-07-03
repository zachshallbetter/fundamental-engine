/**
 * Waves default OFF (#979, doc-06 Step 0) — the Currents are explicit opt-in.
 *
 * A bare field builds NO carrier waves (no wave layers, no bound shimmer reservoir) — byte-identical
 * to `waves: false`. Opting in (`waves: true`) reproduces the previous default: the five wave layers
 * and the `round(16·density)`-per-wave bound pool. The bound pool is not part of `particleCount()`
 * (it is the other half of the particle-count ledger), so the tests observe it through the one public
 * seam that moves matter between the pools: `burst(x, y)` tears bound matter near the point into the
 * free store (§2.4) — a field with waves gains free particles from a burst; a bare field cannot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { FieldOptions } from './types.ts';

/** minimal deterministic host (geometry + time only), same floor as minimal-host.test.ts. */
function minimalHost(width = 800, height = 600) {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = {
    querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    querySelector: () => null,
    contains: () => false,
  } as unknown as ParentNode;
  return {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    raf: (cb: (t: number) => void) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    tick() {
      t += 1000 / 60;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
  };
}

/** mulberry32 — a seeded rng so the bound-pool layout is reproducible across fields. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** boot a headless field, tick a few frames, burst along the wave band, return counts. */
function burstProbe(opts: Partial<FieldOptions>) {
  const host = minimalHost();
  const field = createField(undefined, {
    host: host as unknown as FieldHost,
    render: 'none',
    rng: seededRng(42),
    ...opts,
  });
  for (let i = 0; i < 3; i++) host.tick();
  const before = field.particleCount();
  // sweep the mid band so bound riders on several wave layers are within the tear radius (160).
  for (const x of [150, 400, 650]) {
    field.burst(x, 240); // wave layers anchor at 0.24–0.85 of H=600 → y 144…510
    field.burst(x, 420);
  }
  const after = field.particleCount(); // read BEFORE any further tick — heal would re-bind matter
  field.destroy();
  return { before, after };
}

test('a bare field builds NO waves — byte-identical to waves:false (#979)', () => {
  const bare = burstProbe({});
  const explicit = burstProbe({ waves: false });
  // no bound reservoir exists to tear: bursting changes nothing, on either field.
  assert.equal(bare.after, bare.before, 'bare field: burst tore bound matter — waves were built');
  assert.equal(explicit.after, explicit.before);
  // and the bare field is the same field as the explicit opt-out.
  assert.equal(bare.before, explicit.before);
  assert.equal(bare.after, explicit.after);
});

test('waves: true opts back in — the reservoir exists and burst tears bound matter free', () => {
  const on = burstProbe({ waves: true });
  const off = burstProbe({});
  // the free pool seeds identically (130·density) — waves add the SEPARATE bound pool…
  assert.equal(on.before, off.before, 'waves must not change the free-particle seed count');
  // …which the burst tears into the free store: the opted-in field gains particles.
  assert.ok(on.after > on.before, 'waves:true built no tearable bound reservoir');
});
