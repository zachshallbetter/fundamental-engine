/**
 * The optional z lane (docs/engine-reference/z-axis.md).
 *
 * Two contracts, both load-bearing:
 *
 *   1. FLAT IS EXACT — with no depth (the default), z never moves and every observable
 *      matches the 2D engine bit-for-bit: positions, velocities, energy, conditions.
 *   2. THE VOLUME WORKS — with `env.D > 0` and matter seeded off-plane, forces pull it
 *      back toward the page plane (bodies live at z = 0), z integrates/damps/wraps like
 *      x and y, and the velocity cap bounds the full 3D speed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Body, Env, Particle } from './types.ts';
import { FieldStore } from './field-store.ts';
import { step, FRICTION } from './integrator.ts';
import { coreForces, attract } from '../forces/index.ts';
import { gravity } from '../forces/natural.ts';
import { conditions } from './conditions.ts';
import { kineticEnergy } from '../diagnostics/energy.ts';
import { burstImpulse } from './reactions.ts';

const FORCES = Object.fromEntries([...coreForces, gravity].map((f) => [f.token, f]));

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    dx: 0,
    dy: 0,
    dz: 0,
    dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W: 800,
    H: 600,
    D: 0,
    t: 0,
    frameN: 1, // not a multiple of 40 → no brownian, deterministic
    dt: 1,
    c: 12,
    G: 1,
    scrollV: 0,
    spark: () => {},
    supernova: () => {},
    spawn: () => {},
    neighbors: () => [],
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
    ...over,
  };
}

function makeBody(tokens: string[], over: Partial<Body> = {}): Body {
  return {
    el: null as unknown as HTMLElement,
    tokens,
    strength: 1,
    range: 300,
    absorbR: 10,
    capacity: 30,
    spin: 1,
    angle: 0,
    ux: 1,
    uy: 0,
    when: '',
    feedback: false,
    fmin: 0,
    fmax: 0,
    opsz: '',
    M: 1,
    cx: 400,
    cy: 300,
    hw: 40,
    hh: 20,
    on: false,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
    ...over,
  };
}

function particle(over: Partial<Particle> = {}): Particle {
  return { x: 500, y: 300, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...over };
}

// ── contract 1: flat is exact ────────────────────────────────────────────────

test('flat field: a z-less particle and a z=0 particle integrate identically', () => {
  const a = new FieldStore();
  const pA = a.add(particle({ vx: 3, vy: -2 })); // no z fields at all (the 2D shape)
  const b = new FieldStore();
  const pB = b.add(particle({ vx: 3, vy: -2, z: 0, vz: 0 }));
  const body = makeBody(['attract']);

  for (let i = 0; i < 30; i++) {
    a.reindex();
    b.reindex();
    step({ store: a, bodies: [makeBody(['attract'])], env: makeEnv(), forces: FORCES, conditions: {} });
    step({ store: b, bodies: [body], env: makeEnv(), forces: FORCES, conditions: {} });
  }
  assert.equal(pA.x, pB.x);
  assert.equal(pA.y, pB.y);
  assert.equal(pA.vx, pB.vx);
  assert.equal(pA.vy, pB.vy);
  assert.equal(pA.z, 0); // the lane normalized in, but never moved
  assert.equal(pA.vz, 0);
});

test('flat field: z stays exactly 0 through attract + gravity + wander-free steps', () => {
  const store = new FieldStore();
  const p = store.add(particle({ x: 520, y: 340, vx: 1, vy: 1 }));
  for (let i = 0; i < 60; i++) {
    store.reindex();
    step({
      store,
      bodies: [makeBody(['attract']), makeBody(['gravity'], { cx: 200, cy: 200 })],
      env: makeEnv(),
      forces: FORCES,
      conditions: {},
    });
  }
  assert.equal(p.z, 0);
  assert.equal(p.vz, 0);
});

test('flat field: kinetic energy matches the 2D formula exactly', () => {
  const ps = [particle({ vx: 3, vy: 4 }), particle({ vx: -1, vy: 2, vz: 0 })];
  assert.equal(kineticEnergy(ps), 0.5 * (9 + 16) + 0.5 * (1 + 4));
});

test('flat field: burstImpulse with no dz is the 2D impulse exactly', () => {
  const flat = burstImpulse(80, 0, 160);
  assert.equal(flat.vx, 3); // (1 − 0.5)·6
  assert.equal(flat.vz, 0);
});

// ── contract 2: the volume works ─────────────────────────────────────────────

test('volume: attract pulls off-plane matter back toward the page plane', () => {
  const store = new FieldStore();
  const p = store.add(particle({ x: 400, y: 300, z: 120, vz: 0 })); // directly above the body
  const env = makeEnv({ D: 300 });
  store.reindex();
  step({ store, bodies: [makeBody(['attract'])], env, forces: FORCES, conditions: {} });
  assert.ok(p.vz! < 0, `vz should pull toward the plane, got ${p.vz}`);
});

test('volume: gravity z leg follows the inverse-square kernel', () => {
  const store = new FieldStore();
  const near = store.add(particle({ x: 400, y: 300, z: 50 }));
  const far = store.add(particle({ x: 400, y: 300, z: 250 }));
  const env = makeEnv({ D: 300 });
  store.reindex();
  step({ store, bodies: [makeBody(['gravity'], { M: 100, range: 1000 })], env, forces: FORCES, conditions: {} });
  assert.ok(near.vz! < 0 && far.vz! < 0); // both pulled toward the plane
  assert.ok(Math.abs(near.vz!) > Math.abs(far.vz!)); // 1/d² falloff in z too
});

test('volume: z integrates, damps, and wraps toroidally like x and y', () => {
  const store = new FieldStore();
  const p = store.add(particle({ z: 100, vz: 5 }));
  const env = makeEnv({ D: 300 });
  store.reindex();
  step({ store, bodies: [], env, forces: {}, conditions: {} });
  assert.equal(p.z, 105); // integrated
  assert.ok(Math.abs(p.vz! - 5 * FRICTION) < 1e-12); // damped

  const w = new FieldStore();
  const q = w.add(particle({ z: 309, vz: 5 })); // 309 + 5 = 314 > D + EDGE (310)
  w.reindex();
  step({ store: w, bodies: [], env: makeEnv({ D: 300 }), forces: {}, conditions: {} });
  assert.equal(q.z, -10); // wrapped to −EDGE
});

test('volume: the c velocity cap bounds the full 3D speed', () => {
  const store = new FieldStore();
  const p = store.add(particle({ vx: 10, vy: 10, vz: 10 })); // |v| ≈ 17.3 > c = 12
  store.reindex();
  step({ store, bodies: [], env: makeEnv({ D: 300 }), forces: {}, conditions: {} });
  const sp = Math.hypot(p.vx, p.vy, p.vz!) / FRICTION; // un-damp to read the capped speed
  assert.ok(sp <= 12 + 1e-6, `3D speed should cap at c, got ${sp}`);
});

test('volume: captured matter settles to the sink core on the plane', () => {
  const sink = makeBody(['sink']);
  const store = new FieldStore();
  const p = store.add(particle({ x: 500, y: 400, z: 80, cap: sink }));
  for (let i = 0; i < 40; i++) {
    store.reindex();
    step({ store, bodies: [sink], env: makeEnv({ D: 300 }), forces: FORCES, conditions: {} });
  }
  assert.ok(Math.abs(p.z!) < 1); // drifted home to z = 0
});

test('volume: range culling counts z — a body cannot reach matter far above it', () => {
  const b = makeBody(['attract'], { range: 100 });
  const store = new FieldStore();
  const p = store.add(particle({ x: 400, y: 300, z: 200 })); // in-plane distance 0, z 200 > 1.6×range
  store.reindex();
  step({ store, bodies: [b], env: makeEnv({ D: 400 }), forces: FORCES, conditions: {} });
  assert.equal(p.vx, 0);
  assert.equal(p.vz, 0);
});

test('conditions: fast/slow gates read the 3D speed', () => {
  const b = makeBody(['attract']);
  const stillButDeepFast = particle({ vx: 0, vy: 0, vz: 1.5 });
  assert.ok(conditions.fast!(b, stillButDeepFast));
  const slow2D = particle({ vx: 0.1, vy: 0.1 });
  assert.ok(conditions.slow!(b, slow2D)); // no vz → exactly the 2D reading
});

test('apply: attract on a z-less particle never materializes a moving z lane', () => {
  // a force applied directly (the conformance path) with dz unset/0 must leave vz absent or 0
  const p = particle();
  const e = makeEnv();
  e.dx = -100;
  e.dy = 0;
  e.dist = 100;
  attract.apply(makeBody(['attract']), p, e);
  assert.ok(p.vx < 0);
  assert.ok(!p.vz); // undefined or 0 — never a spurious z push
});
