/**
 * Runtime FIELD POLICY + FIELD BUDGET model (feat/field-policy).
 *
 * Lives at the top level (`src/*.test.ts`) so the RC-6 contract-coverage guard
 * (contract-coverage.test.ts, non-recursive scan) sees the `policy` FieldOptions key referenced here.
 *
 * Covers the two WIRED budgets:
 *  - motion: folds reduced-motion + policy into the effective motion the integrator reads. A partial
 *    budget slows travel; `0` (or `allowMotionProjection:false`) freezes it like reduced-motion; and
 *    reduced-motion CANNOT be overridden upward by policy (accessibility clamp).
 *  - privacy: gates body `data` in snapshot() — a low privacy budget / explicit deny withholds data even
 *    when the caller asks for `includeData`.
 * Plus the surface itself (createField({ policy }), setPolicy replace-semantics, field.policy frozen copy).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './core/field.ts';
import type { FieldHost } from './core/host.ts';
import type { FieldPolicy } from './core/types.ts';

/** a stub host that captures the rAF callback so tests can step frames deterministically. */
function steppableHost(reducedMotion: boolean): { host: FieldHost; tick: (n: number) => void } {
  const off = (): void => {};
  let frameCb: ((t: number) => void) | null = null;
  let t = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => reducedMotion,
    hidden: () => false,
    raf: (cb) => {
      frameCb = cb;
      return 1;
    },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const tick = (n: number): void => {
    for (let i = 0; i < n; i++) {
      t += 16;
      frameCb?.(t);
    }
  };
  return { host, tick };
}

function snapshot(field: ReturnType<typeof createField>): Float32Array {
  const out = new Float32Array(field.particleCount() * 5);
  field.readParticles(out);
  return out;
}

function maxTravel(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i += 5) {
    const dx = (b[i] ?? 0) - (a[i] ?? 0);
    const dy = (b[i + 1] ?? 0) - (a[i + 1] ?? 0);
    m = Math.max(m, Math.hypot(dx, dy));
  }
  return m;
}

function travelOver(field: ReturnType<typeof createField>, tick: (n: number) => void, frames: number): number {
  const before = snapshot(field);
  tick(frames);
  const after = snapshot(field);
  return maxTravel(before, after);
}

test('policy: field accepts a createField({ policy }) and reads it back (frozen copy)', () => {
  const { host } = steppableHost(false);
  const policy: FieldPolicy = { maxMotionBudget: 0.5, budgets: { privacy: 0.2 } };
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy });
  try {
    assert.equal(field.policy.maxMotionBudget, 0.5);
    assert.equal(field.policy.budgets?.privacy, 0.2);
    // mutating the caller's object must not reach the live policy (it was cloned in).
    policy.maxMotionBudget = 1;
    assert.equal(field.policy.maxMotionBudget, 0.5, 'live policy is insulated from later caller mutation');
    // and the returned copy is likewise frozen — mutating it must not change the field.
    field.policy.maxMotionBudget = 1;
    assert.equal(field.policy.maxMotionBudget, 0.5, 'field.policy returns a copy');
  } finally {
    field.destroy();
  }
});

test('policy: no policy → {} (unbounded default)', () => {
  const { host } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    assert.deepEqual(field.policy, {});
  } finally {
    field.destroy();
  }
});

test('motion budget 0 freezes travel exactly like reduced-motion', () => {
  const { host, tick } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { maxMotionBudget: 0 } });
  try {
    assert.ok(travelOver(field, tick, 30) < 1e-6, 'maxMotionBudget:0 freezes matter');
  } finally {
    field.destroy();
  }
});

test('allowMotionProjection:false pins motion off', () => {
  const { host, tick } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { allowMotionProjection: false } });
  try {
    assert.ok(travelOver(field, tick, 30) < 1e-6, 'allowMotionProjection:false freezes matter');
  } finally {
    field.destroy();
  }
});

test('motion budget clamps: a partial budget travels less than full motion', () => {
  const full = steppableHost(false);
  const half = steppableHost(false);
  const fieldFull = createField({} as HTMLCanvasElement, { host: full.host, render: 'none' });
  const fieldHalf = createField({} as HTMLCanvasElement, { host: half.host, render: 'none', policy: { maxMotionBudget: 0.25 } });
  try {
    const tFull = travelOver(fieldFull, full.tick, 30);
    const tHalf = travelOver(fieldHalf, half.tick, 30);
    assert.ok(tFull > 0, 'full-motion field moves');
    assert.ok(tHalf > 0, 'a partial budget still allows some motion');
    assert.ok(tHalf < tFull, 'a smaller motion budget travels less');
  } finally {
    fieldFull.destroy();
    fieldHalf.destroy();
  }
});

test('reduced-motion cannot be overridden upward by policy (accessibility clamp)', () => {
  const { host, tick } = steppableHost(true); // host asks for reduced motion
  // policy tries to allow full motion — accessibility must win.
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { maxMotionBudget: 1, allowMotionProjection: true } });
  try {
    assert.ok(travelOver(field, tick, 30) < 1e-6, 'reduced-motion still freezes matter despite a permissive policy');
  } finally {
    field.destroy();
  }
});

test('setPolicy REPLACES the policy live and re-frees / re-animates motion', () => {
  const { host, tick } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { maxMotionBudget: 0 } });
  try {
    assert.ok(travelOver(field, tick, 20) < 1e-6, 'starts frozen (budget 0)');
    field.setPolicy({}); // replace with the unbounded default → motion returns
    assert.ok(travelOver(field, tick, 20) > 0, 'unfreezes after setPolicy({})');
    field.setPolicy({ allowMotionProjection: false }); // replace again → frozen
    assert.ok(travelOver(field, tick, 20) < 1e-6, 're-freezes after a new restrictive policy');
  } finally {
    field.destroy();
  }
});

test('privacy: explicit allowBodyDataInSnapshots:false withholds body data even when includeData is set', () => {
  const { host } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { allowBodyDataInSnapshots: false } });
  try {
    field.addBody({ tokens: ['gravity'], data: { secret: 42 }, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
    const snap = field.snapshot({ includeData: true });
    for (const b of snap.bodies) {
      assert.equal(b.data, undefined, 'body data is withheld under a deny policy');
    }
  } finally {
    field.destroy();
  }
});

test('privacy budget below threshold withholds body data', () => {
  const { host } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { budgets: { privacy: 0.1 } } });
  try {
    field.addBody({ tokens: ['gravity'], data: { secret: 42 }, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
    const withheld = field.snapshot({ includeData: true });
    for (const b of withheld.bodies) assert.equal(b.data, undefined, 'low privacy budget withholds data');
    // raising the budget above the threshold lets the caller opt in again.
    field.setPolicy({ budgets: { privacy: 1 } });
    const shared = field.snapshot({ includeData: true });
    assert.ok(shared.bodies.some((b) => b.data !== undefined), 'a high privacy budget permits opted-in data');
  } finally {
    field.destroy();
  }
});

test('privacy: policy never widens the default — data stays off when includeData is not set', () => {
  const { host } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', policy: { allowBodyDataInSnapshots: true, budgets: { privacy: 1 } } });
  try {
    field.addBody({ tokens: ['gravity'], data: { secret: 42 }, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
    const snap = field.snapshot(); // no includeData
    for (const b of snap.bodies) assert.equal(b.data, undefined, 'a permissive policy does not force data on');
  } finally {
    field.destroy();
  }
});
