/**
 * Injectable randomness (#371): every random draw in the simulation flows through `env.rng` /
 * `FieldOptions.rng`, so a seeded generator makes a run reproducible — the seam record/replay
 * needs. Pinned here at the integrator level: two identically-seeded runs over identical pools
 * produce bit-identical positions; an unseeded fixture still works (the Math.random fallback).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step } from './integrator.ts';
import { FieldStore } from './field-store.ts';
import type { Env, Particle } from './types.ts';

/** A tiny deterministic LCG — the classic Lehmer form, plenty for a reproducibility pin. */
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const makeEnv = (over: Partial<Env> = {}): Env =>
  ({
    dx: 0,
    dy: 0,
    dist: 1,
    form: { driftX: 0, wander: 0.8, orbit: 0, spread: 0, conv: 0 }, // wander > 0 → jitter draws every frame
    W: 1000,
    H: 800,
    t: 0,
    frameN: 1,
    dt: 1,
    c: 12,
    G: 1,
    spark: () => {},
    supernova: () => {},
    spawn: () => {},
    neighbors: () => [],
    grid: () => ({ deposit: () => {}, sample: () => 0, gradient: () => ({ x: 0, y: 0 }) }) as never,
    ...over,
  }) as Env;

const particle = (i: number): Particle =>
  ({
    x: 100 + i * 37,
    y: 100 + i * 23,
    vx: 0.1 * i,
    vy: -0.05 * i,
    m: 1,
    heat: 0,
    size: 1,
    cap: null,
    gx: 0.5,
    gy: 0.5,
  }) as unknown as Particle;

function runFrames(seed: number, frames: number): string {
  const store = new FieldStore();
  for (let i = 0; i < 8; i++) store.add(particle(i));
  const env = makeEnv({ rng: lcg(seed) });
  for (let f = 1; f <= frames; f++) {
    env.frameN = f;
    step({ store, bodies: [], env, forces: {}, conditions: {} });
  }
  return store.particles.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.vx.toFixed(6)},${p.vy.toFixed(6)}`).join('|');
}

test('two identically-seeded runs are bit-identical across 60 jittering frames', () => {
  assert.equal(runFrames(42, 60), runFrames(42, 60));
});

test('different seeds genuinely diverge (the rng is actually consulted)', () => {
  assert.notEqual(runFrames(42, 60), runFrames(43, 60));
});

test('an env without rng still steps (the Math.random fallback)', () => {
  const store = new FieldStore();
  store.add(particle(0));
  assert.doesNotThrow(() => step({ store, bodies: [], env: makeEnv(), forces: {}, conditions: {} }));
});
