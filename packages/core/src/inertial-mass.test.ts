/**
 * First-class inertial mass, measured (#1142 / #872).
 *
 * `mass: true` gives a dynamic body inertia from its RENDERED AREA:
 * `inertia = clamp(sqrt(area / 4800), 0.4, 4)`, and recoil is `a = F/inertia`. A heavy heading should
 * settle slowly; a small tag should snap.
 *
 * **How this is measured matters more than it looks.** The obvious experiment — two bodies of
 * different size side by side, compare how far each moves — does NOT measure mass. Two bodies in
 * different places sit in different matter, so their recoil differs for two reasons at once and the
 * ratio is not the mass ratio. Measured that way the answer comes out near 6.4 against a predicted 4,
 * and the excess is entirely neighbourhood, not inertia.
 *
 * So these hold POSITION constant and vary only area: one body per run, always at the same point in
 * the same seeded field. That isolates the one variable, and the relationship comes out exact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import { seededRng } from './record/rng.ts';
import type { FieldHost } from './engine/host.ts';

function harness(): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1200, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 600,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  return { host, step: (n) => { for (let i = 0; i < n; i++) { now += 16; cb?.(now); } } };
}

/** How far a single dynamic body of this rendered size recoils, alone, at a fixed point. */
function recoil(w: number, h: number, frames = 10, opts: { mass?: boolean } = {}): number {
  const { host, step } = harness();
  const field = createField({} as HTMLCanvasElement, {
    host,
    render: 'none',
    mass: opts.mass ?? true,
    reaction: true, // the body feels the equal-and-opposite of what it pushes (#873)
    rng: seededRng(7),
  });
  field.addBody({
    tokens: 'repel',
    strength: 2,
    range: 200,
    authority: 'dynamic',
    rect: () => ({ left: 600 - w / 2, top: 300 - h / 2, width: w, height: h }),
  });
  const before = (field.query({ include: ['bodies'] }).bodies as Array<{ rect?: { x: number; y: number } }>)[0];
  const x0 = before?.rect?.x ?? 0;
  const y0 = before?.rect?.y ?? 0;
  step(frames);
  const after = (field.query({ include: ['bodies'] }).bodies as Array<{ rect?: { x: number; y: number } }>)[0];
  const d = Math.hypot((after?.rect?.x ?? 0) - x0, (after?.rect?.y ?? 0) - y0);
  field.destroy();
  return d;
}

// 4800px² is the reference area → inertia 1. 240×80 = 19200 → 2. 60×20 = 1200 → 0.5.
const REF = { w: 120, h: 40 }; // 4800px²

test('recoil scales as 1/inertia, and inertia as sqrt(rendered area)', () => {
  const base = recoil(REF.w, REF.h);
  const heavy = recoil(240, 80); // inertia 2 → half the recoil
  const light = recoil(60, 20); // inertia 0.5 → double

  const heavyRatio = heavy / base;
  const lightRatio = light / base;
  assert.ok(
    Math.abs(heavyRatio - 0.5) < 0.05,
    `a body of 4x the area recoils half as far: ${heavyRatio.toFixed(4)} (predicted 0.5)`,
  );
  assert.ok(
    Math.abs(lightRatio - 2.0) < 0.1,
    `a body of a quarter the area recoils twice as far: ${lightRatio.toFixed(4)} (predicted 2.0)`,
  );
});

test('the inertia clamp holds at both ends', () => {
  // clamp(sqrt(area/4800), 0.4, 4): past 76800px² inertia pins at 4, below 768px² at 0.4.
  const huge = recoil(1200, 200); // 240000px² → sqrt ≈ 7.07, clamped to 4
  const enormous = recoil(2000, 400); // 800000px² → clamped to 4 as well
  assert.ok(
    Math.abs(huge - enormous) / Math.max(huge, enormous) < 0.05,
    `past the clamp, more area buys no more inertia: ${huge.toFixed(5)} vs ${enormous.toFixed(5)}`,
  );
});

test('without `mass`, rendered area does not change recoil at all', () => {
  // The control. Inertia falls back to the source mass M, which these bodies share, so size stops
  // mattering — this is what proves the effect above is `mass` and not some other size coupling.
  const heavy = recoil(240, 80, 10, { mass: false });
  const light = recoil(60, 20, 10, { mass: false });
  assert.ok(
    Math.abs(heavy - light) / Math.max(heavy, light) < 1e-9,
    `mass:false makes area irrelevant: ${heavy.toFixed(9)} vs ${light.toFixed(9)}`,
  );
});

test('two bodies side by side is NOT a mass measurement', () => {
  // Kept as a guard against re-deriving the obvious-but-wrong experiment. Two dynamic bodies of
  // different size at different places: the light one moves further, but the ratio is not the mass
  // ratio, because they sit in different matter. The qualitative claim is all that survives here.
  const { host, step } = harness();
  const field = createField({} as HTMLCanvasElement, {
    host, render: 'none', mass: true, reaction: true, rng: seededRng(7),
  });
  field.addBody({ tokens: 'repel', strength: 2, range: 200, authority: 'dynamic',
    rect: () => ({ left: 180, top: 260, width: 240, height: 80 }) });
  field.addBody({ tokens: 'repel', strength: 2, range: 200, authority: 'dynamic',
    rect: () => ({ left: 870, top: 290, width: 60, height: 20 }) });
  const s = (field.query({ include: ['bodies'] }).bodies as Array<{ id: string; rect?: { x: number; y: number } }>)
    .map((b) => ({ id: b.id, x: b.rect?.x ?? 0, y: b.rect?.y ?? 0 }));
  step(10);
  const e = field.query({ include: ['bodies'] }).bodies as Array<{ id: string; rect?: { x: number; y: number } }>;
  const moved = e.map((b) => {
    const st = s.find((p) => p.id === b.id)!;
    return Math.hypot((b.rect?.x ?? 0) - st.x, (b.rect?.y ?? 0) - st.y);
  });
  assert.ok(moved[1] > moved[0], `the light body recoils further: ${moved[1].toFixed(4)} vs ${moved[0].toFixed(4)}`);
  field.destroy();
});
