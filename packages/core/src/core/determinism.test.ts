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
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
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

// ── field-level: the last two leaks (#976) — thermal's Box–Muller draws and the spark-burst
// COUNT now flow through the injected rng, so a seeded run with a thermal body + a discharge
// event is reproducible end to end. The burst matters beyond its own visuals: a non-seeded
// spark count consumed a run-varying number of direction draws from the shared stream, shifting
// every rng draw after it (thermal kicks included) — replays diverged after any discharge.

function headlessHost(width: number, height: number): { host: FieldHost; tick: () => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: () => { t += 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

/** Seeded field, a thermal body agitating the pool, a mid-run discharge; fingerprint the free matter. */
function thermalDischargeFingerprint(seed: number): string {
  const { host, tick } = headlessHost(400, 300);
  // rng + now are the two injected sources (#371) — seed both so the run is reproducible.
  const field = createField(undefined as never, { host, render: 'none', rng: lcg(seed), now: () => 0 });
  field.addBody({ tokens: ['thermal'], strength: 4, range: 400, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  for (let i = 0; i < 20; i++) tick();
  field.burst(200, 150); // the discharge — spark count + directions draw from the shared stream
  for (let i = 0; i < 20; i++) tick();
  const snap = field.snapshot({ includeParticles: true });
  const fp = (snap.particles ?? []).map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.heat.toFixed(6)}`).join('|');
  field.destroy();
  return fp;
}

test('a seeded field with a thermal body + a discharge is bit-identical across two runs (#976)', () => {
  const fp = thermalDischargeFingerprint(7);
  assert.ok(fp.length > 0, 'the pool has free matter to fingerprint');
  assert.equal(fp, thermalDischargeFingerprint(7));
});

test('the thermal + discharge run genuinely consults the seed (different seeds diverge)', () => {
  assert.notEqual(thermalDischargeFingerprint(7), thermalDischargeFingerprint(8));
});
