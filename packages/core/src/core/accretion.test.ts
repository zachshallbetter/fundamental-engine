/**
 * Accretion conformance — the sink submodel's capture → hold → release cycle, exercised end-to-end
 * through the real `step()` integrator and the real `releaseCaptured` release core (no DOM). This is
 * the integration test the audit found missing: it proves captured matter is HELD (stays in the pool),
 * then the SAME particles are released, conserved. Plus the pure `sinkLoad` / `captureEdge` helpers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseCaptured, sinkLoad, captureEdge, dischargeDisengaged } from './accretion.ts';
import { step } from './integrator.ts';
import { FieldStore } from './field-store.ts';
import { sink } from '../forces/index.ts';
import type { Body, Env, Particle } from './types.ts';

const FORM = { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 };

const sinkBody = (o: Partial<Body> = {}): Body => ({
  el: {} as HTMLElement, tokens: ['sink'], strength: 1, range: 300, absorbR: 80, capacity: 1000,
  spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '',
  M: 1, cx: 500, cy: 500, hw: 0, hh: 0, on: false, vis: true, accreted: 0, count: 0, d: 0, attn: 1, ...o,
});

const makeEnv = (store: FieldStore, rng: () => number): Env => ({
  dx: 0, dy: 0, dist: 1, form: FORM, W: 1000, H: 1000, t: 0, frameN: 1, dt: 1, c: 12, G: 1,
  spark: () => {}, spawn: () => {}, neighbors: () => [], grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  supernova: (b) => void releaseCaptured(store.particles, b, rng),
});

// a small deterministic PRNG so the release is reproducible.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function fill(store: FieldStore, n: number, cx: number, cy: number): Particle[] {
  const ps: Particle[] = [];
  for (let i = 0; i < n; i++) ps.push(store.add({ x: cx + i, y: cy, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null }));
  return ps;
}

test('1a. a sink CAPTURES nearby matter and HOLDS it (kept in the pool, not deleted)', () => {
  const store = new FieldStore();
  const body = sinkBody({ capacity: 1000 }); // high cap → no supernova during capture
  const ps = fill(store, 5, 500, 500); // all within absorbR of the core
  step({ store, bodies: [body], env: makeEnv(store, seeded(1)), forces: { sink }, conditions: {} });

  assert.equal(body.accreted, 5, 'all five captured → accreted load is 5');
  assert.equal(store.size, 5, 'held, not deleted — the pool is unchanged');
  for (const p of ps) assert.equal(p.cap, body, 'each particle records the sink holding it');
});

test('1b. held matter DRIFTS to the core on the next step, still captured + still pooled', () => {
  const store = new FieldStore();
  const body = sinkBody({ capacity: 1000 });
  const ps = fill(store, 3, 540, 500); // 40px off-core, inside absorbR
  const env = makeEnv(store, seeded(2));
  step({ store, bodies: [body], env, forces: { sink }, conditions: {} }); // capture
  const before = ps.map((p) => Math.hypot(p.x - body.cx, p.y - body.cy));
  step({ store, bodies: [body], env, forces: { sink }, conditions: {} }); // hold + drift
  const after = ps.map((p) => Math.hypot(p.x - body.cx, p.y - body.cy));

  for (let i = 0; i < ps.length; i++) {
    assert.ok(after[i]! < before[i]!, 'captured matter drifts toward the core');
    assert.equal(ps[i]!.cap, body, 'still held');
  }
  assert.equal(store.size, 3, 'still conserved in the pool');
});

test('1c. on RELEASE the SAME particles are freed (conserved), repositioned + flung outward', () => {
  const store = new FieldStore();
  const body = sinkBody({ capacity: 1000 });
  const ps = fill(store, 6, 500, 500);
  step({ store, bodies: [body], env: makeEnv(store, seeded(3)), forces: { sink }, conditions: {} });
  assert.equal(body.accreted, 6);

  const released = releaseCaptured(store.particles, body, seeded(7));
  assert.equal(released.length, 6, 'exactly what it held is released');
  assert.equal(new Set(released).size, 6, 'the same six particles — none duplicated or dropped');
  assert.equal(store.size, 6, 'released into the pool, not destroyed — count conserved');
  assert.equal(body.accreted, 0, 'load resets to empty');
  for (const p of ps) {
    assert.equal(p.cap, null, 'no longer held');
    assert.equal(p.x, body.cx, 'repositioned at the core');
    assert.equal(p.y, body.cy);
    assert.ok(Math.hypot(p.vx, p.vy) > 0, 'flung outward with a radial velocity');
    assert.equal(p.heat, 1, 'released hot');
  }
});

test('1d. saturation auto-releases through env.supernova when load reaches capacity', () => {
  const store = new FieldStore();
  const body = sinkBody({ capacity: 3 }); // small cap → supernova fires within the step
  fill(store, 3, 500, 500);
  step({ store, bodies: [body], env: makeEnv(store, seeded(4)), forces: { sink }, conditions: {} });
  // after a supernova, the load is reset and the matter is conserved (still pooled).
  assert.equal(body.accreted, 0, 'saturation released the core (load back to 0)');
  assert.equal(store.size, 3, 'conserved — released, not deleted');
});

test('2a. sinkLoad is the clamped fill fraction accreted/capacity', () => {
  assert.equal(sinkLoad(sinkBody({ accreted: 0, capacity: 60 })), 0);
  assert.equal(sinkLoad(sinkBody({ accreted: 30, capacity: 60 })), 0.5);
  assert.equal(sinkLoad(sinkBody({ accreted: 90, capacity: 60 })), 1, 'clamped to 1 above capacity');
  assert.equal(sinkLoad(sinkBody({ accreted: 5, capacity: 0 })), 0, 'no capacity → 0, never divides by zero');
});

test('2b. captureEdge fires captured on the rising edge and released on the falling edge', () => {
  assert.deepEqual(captureEdge(false, false), { fire: null, armed: false });
  assert.deepEqual(captureEdge(false, true), { fire: 'captured', armed: true }, 'began accreting');
  assert.deepEqual(captureEdge(true, true), { fire: null, armed: true }, 'still accreting — no repeat');
  assert.deepEqual(captureEdge(true, false), { fire: 'released', armed: false }, 'load dropped to 0');
  assert.deepEqual(captureEdge(false, false), { fire: null, armed: false });
});

test('3a. dischargeDisengaged releases on the falling edge of engagement — and only then', () => {
  const b = sinkBody({ accreted: 5, when: 'active' });
  const released: unknown[] = [];
  const release = (x: unknown) => released.push(x);

  b.on = true;
  dischargeDisengaged([b], release);
  assert.equal(released.length, 0, 'engaged and holding — keeps charging');

  b.on = false; // attention leaves
  const out = dischargeDisengaged([b], release);
  assert.deepEqual(out, [b], 'the falling edge discharges');
  assert.equal(released.length, 1);

  dischargeDisengaged([b], release);
  assert.equal(released.length, 1, 'stays quiet while disengaged — edge, not level');
});

test('3b. dischargeDisengaged ignores ungated sinks, non-sinks, and empty vessels', () => {
  const ungated = sinkBody({ accreted: 5, when: '' });
  const empty = sinkBody({ accreted: 0, when: 'active' });
  const notSink = sinkBody({ accreted: 5, when: 'active' });
  notSink.tokens = ['attract'];
  const released: unknown[] = [];
  for (const b of [ungated, empty, notSink]) {
    b.wasOn = true;
    b.on = false;
  }
  dischargeDisengaged([ungated, empty, notSink], (x) => released.push(x));
  assert.equal(released.length, 0, 'no discharge outside the gated, holding sink case');
});

test('1e. a supernova ejects MORTAL captured matter as PERSISTENT (conservation event)', () => {
  // mortal source-spawned matter that a sink captured and held is released immortal — so a
  // source→sink→supernova loop conserves: the matter the source made becomes lasting field.
  const store = new FieldStore();
  const body = sinkBody({ capacity: 1000 });
  // two captured particles: one mortal (from a [S] source), one immortal (the base pool)
  const mortal = store.add({ x: 500, y: 500, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: body, age: 12 });
  const immortal = store.add({ x: 500, y: 500, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: body });
  body.accreted = 2;

  releaseCaptured(store.particles, body, seeded(9));

  assert.equal(store.size, 2, 'both conserved — released into the pool, none destroyed');
  assert.equal(mortal.age, undefined, 'the mortal one is released immortal — it persists, never returns to dying');
  assert.equal(immortal.age, undefined, 'the immortal one is unchanged (no-op)');
  assert.equal(mortal.cap, null);
  assert.equal(immortal.cap, null);
});
