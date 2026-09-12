/**
 * The resting-motion floor (board #24 "resting liveliness") — DECLARED, default OFF.
 *
 * Signals-first defaults leave a drawn field settling into its wells and freezing when idle. The
 * floor is the honest alternative to painting waves: a small per-particle impulse the field measures
 * as --temperature, with nothing drawn. These tests pin:
 *   - the `flow` field is divergence-free by construction (∂vx/∂x + ∂vy/∂y ≡ 0) and not trivial;
 *   - OFF is really off: an idle field with the ambient drift stilled settles to rest (the default
 *     step is unchanged, which is what keeps the cross-plane golden byte-identical);
 *   - `thermal` and `flow` each keep that same idle field alive; `strength: 0` is the off path;
 *   - reduced motion (dt = 0) contributes exactly nothing;
 *   - `thermal` draws through the injected rng, so a seeded run reproduces and a different seed diverges.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import { restingFlow } from './engine/integrator.ts';
import { seededRng } from './record/rng.ts';
import type { FieldHost } from './engine/host.ts';
import type { FieldHandle, FieldOptions } from './engine/types.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

/** A manual-clock host: `tick(n)` runs n frames at 60 Hz by invoking the engine's re-armed raf callback. */
function makeHost(reduced = false): { host: FieldHost; tick: (n: number) => void } {
  let cb: ((t: number) => void) | null = null;
  let t = 0;
  const off = (): void => {};
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => reduced,
    hidden: () => false,
    raf: (f) => {
      cb = f;
      return 1;
    },
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const tick = (n: number): void => {
    for (let i = 0; i < n; i++) {
      t += 1000 / 60;
      const f = cb;
      cb = null;
      f?.(t);
    }
  };
  return { host, tick };
}

/** the idle baseline: nothing drawn, no waves, the ambient formation's own drift stilled, no bodies. */
const IDLE: FieldOptions = { render: 'none', waves: false, ambientWander: 0, ambientOrbit: 0, density: 1 };

function positions(field: FieldHandle): Float32Array {
  const n = field.particleCount();
  const out = new Float32Array(n * 5);
  const c = field.readParticles(out);
  const pos = new Float32Array(c * 2);
  for (let i = 0; i < c; i++) {
    pos[2 * i] = out[5 * i]!;
    pos[2 * i + 1] = out[5 * i + 1]!;
  }
  return pos;
}

/** mean per-frame displacement over `frames` frames (edge wraps excluded). */
function meanStep(field: FieldHandle, tick: (n: number) => void, frames = 30): number {
  let sum = 0;
  let cnt = 0;
  let prev = positions(field);
  for (let f = 0; f < frames; f++) {
    tick(1);
    const cur = positions(field);
    for (let i = 0; i < cur.length; i += 2) {
      const dx = cur[i]! - prev[i]!;
      const dy = cur[i + 1]! - prev[i + 1]!;
      if (Math.abs(dx) > 50 || Math.abs(dy) > 50) continue; // a toroidal wrap, not motion
      sum += Math.hypot(dx, dy);
      cnt++;
    }
    prev = cur;
  }
  return cnt ? sum / cnt : 0;
}

function idleStep(opts: FieldOptions, reduced = false): { field: FieldHandle; settled: number } {
  const { host, tick } = makeHost(reduced);
  const field = createField(fakeCanvas(), { ...IDLE, host, rng: seededRng(1), ...opts });
  tick(240); // let the seeded launch velocities decay (0.95^240 ≈ 4e-6)
  const settled = meanStep(field, tick, 30);
  field.destroy();
  return { field, settled };
}

test('restingFlow is divergence-free by construction, and not trivial', () => {
  const h = 1e-3;
  let maxDiv = 0;
  let maxMag = 0;
  const rng = seededRng(42);
  for (let i = 0; i < 200; i++) {
    const x = rng() * 800;
    const y = rng() * 600;
    const phase = rng() * Math.PI * 2;
    const dvxdx = (restingFlow(x + h, y, phase).x - restingFlow(x - h, y, phase).x) / (2 * h);
    const dvydy = (restingFlow(x, y + h, phase).y - restingFlow(x, y - h, phase).y) / (2 * h);
    maxDiv = Math.max(maxDiv, Math.abs(dvxdx + dvydy));
    const v = restingFlow(x, y, phase);
    maxMag = Math.max(maxMag, Math.hypot(v.x, v.y));
  }
  assert.ok(maxDiv < 1e-5, `∂vx/∂x + ∂vy/∂y should vanish everywhere (max ${maxDiv})`);
  assert.ok(maxMag > 0.5, 'the flow field is not the zero field');
});

test('OFF is really off: an idle field with the ambient drift stilled settles to rest (the default step is unchanged)', () => {
  const { settled } = idleStep({});
  assert.ok(settled < 0.02, `idle mean step should be ≈0 with the floor off, got ${settled.toFixed(4)}`);
});

test('the thermal floor keeps an idle field alive with nothing drawn', () => {
  const { settled } = idleStep({ restingMotion: { mode: 'thermal' } });
  assert.ok(settled > 0.08, `thermal floor should lift the idle mean step well above rest, got ${settled.toFixed(4)}`);
});

test('the flow floor keeps an idle field alive with nothing drawn', () => {
  const { settled } = idleStep({ restingMotion: { mode: 'flow' } });
  assert.ok(settled > 0.08, `flow floor should lift the idle mean step well above rest, got ${settled.toFixed(4)}`);
});

test('strength 0 is the off path; strength scales the floor', () => {
  const { settled: zero } = idleStep({ restingMotion: { mode: 'thermal', strength: 0 } });
  assert.ok(zero < 0.02, `strength 0 should be off, got ${zero.toFixed(4)}`);
  const { settled: one } = idleStep({ restingMotion: { mode: 'thermal', strength: 1 } });
  const { settled: two } = idleStep({ restingMotion: { mode: 'thermal', strength: 2 } });
  assert.ok(two > one * 1.5, `strength 2 should move matter more than strength 1 (${two.toFixed(4)} vs ${one.toFixed(4)})`);
});

test('reduced motion: the floor contributes exactly nothing (dt = 0)', () => {
  for (const mode of ['thermal', 'flow'] as const) {
    const { host, tick } = makeHost(true);
    const field = createField(fakeCanvas(), { ...IDLE, host, rng: seededRng(1), restingMotion: { mode } });
    const before = positions(field);
    tick(60);
    const after = positions(field);
    assert.deepEqual(after, before, `${mode}: no particle may move under reduced motion`);
    field.destroy();
  }
});

test('thermal draws through the injected rng: a seeded run reproduces, a different seed diverges', () => {
  const run = (seed: number): Float32Array => {
    const { host, tick } = makeHost();
    const field = createField(fakeCanvas(), { ...IDLE, host, rng: seededRng(seed), restingMotion: { mode: 'thermal' } });
    tick(120);
    const p = positions(field);
    field.destroy();
    return p;
  };
  assert.deepEqual(run(7), run(7), 'same seed → identical positions');
  assert.notDeepEqual(run(7), run(8), 'different seed → different positions');
});
