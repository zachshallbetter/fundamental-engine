/**
 * Property-based fuzzing of the integrator (#691).
 *
 * Random-but-valid field configs — bodies, the canonical force set, and formation/env params
 * within their documented ranges — stepped many ticks, asserting the engine's invariants hold
 * across the whole space, not just the hand-built fixtures:
 *
 *   1. COUNT is conserved (§2.4 — the one strong invariant of the physics caveat canon). No
 *      source forces, no mortal `age`, and the spawn/supernova env hooks are inert here, so the
 *      pool size must never change across the run.
 *   2. No NaN / no Infinity ever appears in a position or velocity (the safety sweep — a
 *      NaN-producing force or composite is the classic blow-up).
 *   3. Values stay finite AND bounded: positions sit within the wrap halo and velocities never
 *      exceed env.c (the global §20.10 cap), so energy cannot blow up.
 *
 * Every case is driven by a seeded LCG (no top-level Math.random), so any failure reproduces
 * exactly from its (seed, caseIndex) — the message prints both. Bounded cases × ticks keeps the
 * runtime well under a second.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step } from './integrator.ts';
import { FieldStore } from './field-store.ts';
import { coreForces } from '../forces/index.ts';
import type { Body, Env, Force, ForceRegistry, Particle } from './types.ts';

/** The classic Lehmer LCG (matches determinism.test.ts) — deterministic, seedable, dependency-free. */
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const W = 1000;
const H = 800;

/** A draw in [lo, hi). */
const range = (rng: () => number, lo: number, hi: number): number => lo + rng() * (hi - lo);
/** An integer draw in [lo, hi]. */
const int = (rng: () => number, lo: number, hi: number): number => Math.floor(range(rng, lo, hi + 1));
/** Pick one element. */
const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[int(rng, 0, xs.length - 1)]!;

const FORCE_REGISTRY: ForceRegistry = Object.fromEntries(
  coreForces.map((f) => [f.token, f] as const),
) as ForceRegistry;
const FORCE_TOKENS = coreForces.map((f) => f.token);

/** A random free particle with finite, in-bounds state. No `age` ⇒ immortal (count-conserved). */
function randomParticle(rng: () => number): Particle {
  return {
    x: range(rng, 0, W),
    y: range(rng, 0, H),
    vx: range(rng, -8, 8),
    vy: range(rng, -8, 8),
    m: range(rng, 0.25, 4), // nominal-ish mass; a = F/m stays well-conditioned
    heat: range(rng, 0, 1),
    size: range(rng, 0.5, 3),
    cap: null,
    gx: rng(),
    gy: rng(),
  } as Particle;
}

/** A random body carrying one random canonical force, with params in their documented ranges. */
function randomBody(rng: () => number): Body {
  const token = pick(rng, FORCE_TOKENS);
  const angle = range(rng, 0, Math.PI * 2);
  return {
    el: null as unknown as HTMLElement,
    tokens: [token],
    strength: range(rng, 0, 3),
    range: range(rng, 40, 400),
    absorbR: range(rng, 16, 96),
    capacity: int(rng, 8, 120),
    spin: pick(rng, [-1, 1]) * range(rng, 0, 2),
    angle,
    ux: Math.cos(angle),
    uy: Math.sin(angle),
    when: '',
    feedback: false,
    fmin: 0,
    fmax: 0,
    opsz: '',
    M: 1,
    cx: range(rng, 0, W),
    cy: range(rng, 0, H),
    hw: range(rng, 10, 120),
    hh: range(rng, 10, 80),
    on: rng() < 0.3,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
  } as unknown as Body;
}

/** A random env. The spawn/supernova hooks are inert so the pool size cannot change. */
function randomEnv(rng: () => number): Env {
  return {
    dx: 0,
    dy: 0,
    dist: 1,
    form: {
      driftX: range(rng, -1, 1),
      wander: range(rng, 0, 1),
      orbit: range(rng, 0, 1),
      spread: range(rng, 0, 1),
      conv: range(rng, 0, 1),
    },
    W,
    H,
    t: 0,
    frameN: 1,
    dt: 1,
    c: 12,
    G: 1,
    rng,
    spark: () => {},
    supernova: () => {}, // inert: a saturated sink does not despawn matter in the fuzz harness
    spawn: () => {}, // inert: no source matter is created
    neighbors: () => [],
    grid: () => ({ deposit: () => {}, sample: () => 0, gradient: () => ({ x: 0, y: 0 }) }) as never,
  } as Env;
}

const finite = (n: number): boolean => Number.isFinite(n);

const CASES = 200;
const TICKS = 60;
const HALO = 64; // generous slack over EDGE=10 wrap margin, for the worst-case single-tick overshoot

test('fuzz: random valid field configs keep COUNT conserved and never go NaN/unbounded', () => {
  for (let caseIdx = 0; caseIdx < CASES; caseIdx++) {
    const seed = caseIdx + 1;
    const rng = lcg(seed);
    const store = new FieldStore();
    const n = int(rng, 1, 40);
    for (let i = 0; i < n; i++) store.add(randomParticle(rng));
    const bodies: Body[] = [];
    const bodyCount = int(rng, 0, 6);
    for (let i = 0; i < bodyCount; i++) bodies.push(randomBody(rng));
    const env = randomEnv(rng);
    const startCount = store.size;
    const sep = rng() < 0.5 ? range(rng, 0, 1) : 0;

    for (let f = 1; f <= TICKS; f++) {
      env.frameN = f;
      env.t = f * 0.05;
      store.reindex();
      step({ store, bodies, env, forces: FORCE_REGISTRY, conditions: {}, separation: sep });

      // INVARIANT 1 — count is conserved (the one strong invariant, §2.4).
      assert.equal(
        store.size,
        startCount,
        `count drifted: seed=${seed} tick=${f} ${startCount}→${store.size}`,
      );

      for (const p of store.particles) {
        const where = `seed=${seed} tick=${f}`;
        // INVARIANT 2 — no NaN / no Infinity in position or velocity.
        assert.ok(
          finite(p.x) && finite(p.y) && finite(p.vx) && finite(p.vy),
          `non-finite state: ${where} p=(${p.x},${p.y}) v=(${p.vx},${p.vy})`,
        );
        // INVARIANT 3a — velocity never exceeds the global cap c (energy cannot blow up).
        const speed = Math.hypot(p.vx, p.vy);
        assert.ok(speed <= env.c + 1e-6, `speed ${speed} over cap ${env.c}: ${where}`);
        // INVARIANT 3b — positions stay within the toroidal-wrap halo (captured matter excepted —
        // it drifts to its sink core, which is in-bounds by construction).
        assert.ok(
          p.x >= -HALO && p.x <= W + HALO && p.y >= -HALO && p.y <= H + HALO,
          `position escaped: ${where} p=(${p.x},${p.y})`,
        );
      }
    }
  }
});

test('fuzz: two identically-seeded fuzz runs are bit-identical (failures reproduce)', () => {
  const runOne = (seed: number): string => {
    const rng = lcg(seed);
    const store = new FieldStore();
    for (let i = 0; i < 12; i++) store.add(randomParticle(rng));
    const bodies = [randomBody(rng), randomBody(rng), randomBody(rng)];
    const env = randomEnv(rng);
    const forces: Record<string, Force> = FORCE_REGISTRY;
    for (let f = 1; f <= 40; f++) {
      env.frameN = f;
      env.t = f * 0.05;
      store.reindex();
      step({ store, bodies, env, forces, conditions: {} });
    }
    return store.particles
      .map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.vx.toFixed(6)},${p.vy.toFixed(6)}`)
      .join('|');
  };
  assert.equal(runOne(7), runOne(7));
  assert.notEqual(runOne(7), runOne(8));
});
