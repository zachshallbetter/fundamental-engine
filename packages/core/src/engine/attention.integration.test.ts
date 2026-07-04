/**
 * Conserved attention, end-to-end through the integrator — proves the allocator
 * actually redistributes *density*, not just a number. Deterministic (seeded), so
 * it stands in for the live visual the engine renders.
 *
 * Setup is left/right symmetric about the centre, so the only asymmetry is which
 * body is engaged. The attention-specific signal we isolate: engaging one body
 * **starves the others** (drops their effective strength below baseline) — which
 * the on-state boost alone never does (it only lifts the engaged body). So we
 * compare the *idle* body's gathered density with attention on vs off.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step } from './integrator.ts';
import { attentionMuls } from './attention.ts';
import { coreForces } from '../forces/index.ts';
import type { Body, Env, Particle } from './types.ts';

const W = 800;
const H = 600;
const forces = Object.fromEntries(coreForces.map((f) => [f.token, f]));

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeP = (x: number, y: number): Particle => ({
  x, y, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null,
});

const makeBody = (cx: number, cy: number, on: boolean): Body => ({
  el: {} as HTMLElement,
  tokens: ['attract'],
  strength: 1.5,
  range: 240,
  absorbR: 64,
  capacity: 60,
  spin: 1,
  angle: 0,
  ux: 1,
  uy: 0,
  when: '',
  feedback: true,
  fmin: 0,
  fmax: 0,
  opsz: '',
  M: 1,
  cx,
  cy,
  hw: 30,
  hh: 14,
  on,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  attn: 1,
});

const makeEnv = (store: FieldStore): Env => ({
  dx: 0, dy: 0, dist: 1,
  form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W, H, t: 0, frameN: 0, dt: 1, c: 12, G: 1,
  spark: () => {}, supernova: () => {}, spawn: () => {},
  neighbors: (p, r) => store.neighbors(p, r),
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
});

// A is left and (always) engaged here; B is right and idle. Returns each body's
// gathered density (b.count) after the field settles.
function settle(attention: boolean): { a: number; b: number } {
  const store = new FieldStore();
  const rnd = mulberry(7);
  for (let i = 0; i < 500; i++) {
    const x = 60 + rnd() * 320; // left half …
    const y = 40 + rnd() * (H - 80);
    store.add(makeP(x, y));
    store.add(makeP(W - x, y)); // … mirrored to the right half → exact symmetry
  }
  const A = makeBody(280, H / 2, true);
  const B = makeBody(W - 280, H / 2, false);
  const bodies = [A, B];
  const env = makeEnv(store);
  for (let f = 0; f < 160; f++) {
    env.frameN = f;
    store.reindex();
    if (attention) {
      const m = attentionMuls(bodies);
      A.attn = m[0]!;
      B.attn = m[1]!;
    } else {
      A.attn = 1;
      B.attn = 1;
    }
    step({ store, bodies, env, forces, conditions: {} });
  }
  return { a: A.count, b: B.count };
}

test('symmetric control: with nothing engaged the two bodies gather equally', () => {
  // temporarily make A idle too by reading the neutral case via attentionMuls = all 1
  const store = new FieldStore();
  const rnd = mulberry(7);
  for (let i = 0; i < 500; i++) {
    const x = 60 + rnd() * 320;
    const y = 40 + rnd() * (H - 80);
    store.add(makeP(x, y));
    store.add(makeP(W - x, y));
  }
  const A = makeBody(280, H / 2, false);
  const B = makeBody(W - 280, H / 2, false);
  const env = makeEnv(store);
  for (let f = 0; f < 160; f++) {
    env.frameN = f;
    store.reindex();
    step({ store, bodies: [A, B], env, forces, conditions: {} });
  }
  assert.ok(Math.abs(A.count - B.count) < Math.max(A.count, B.count) * 0.1 + 1, `symmetric: ${A.count} ≈ ${B.count}`);
});

test('the engaged body gathers more density than the idle one (attention on)', () => {
  const { a, b } = settle(true);
  assert.ok(a > b, `engaged A gathers more: ${a} vs ${b}`);
});

test('conserved attention starves the idle body — the attention-specific effect', () => {
  const on = settle(true); // A engaged, attention ON  → B's strength drops below baseline
  const off = settle(false); // A engaged, attention OFF → B keeps baseline strength
  // The on-state boost on A is identical in both runs; only attention changes B.
  // So the idle body B must gather strictly less density under attention.
  assert.ok(on.b < off.b, `idle B is starved under attention: ${on.b} < ${off.b}`);
});
