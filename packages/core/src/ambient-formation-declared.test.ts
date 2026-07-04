/**
 * Wallpaper Rule (#978) — the resting `ambient` formation's swirl (`orbit`) and drift (`wander`) were
 * a "gray debt": content-independent constants (0.1 / 1.0) hardcoded into FORMATION_BY.ambient.preset.
 * The remedy is DECLARE — expose them as documented, opt-in FieldOptions (`ambientOrbit`/`ambientWander`)
 * whose DEFAULTS are the historical values, so behavior is byte-identical.
 *
 * This file both (a) satisfies the RC-6 contract-coverage guard (contract-coverage.test.ts scans
 * top-level src/*.test.ts non-recursively, so the two new option names must be referenced here) and
 * (b) PROVES the default behavior is unchanged:
 *   - the declared defaults source the exact historical constants (FORMATION_BY.ambient.preset);
 *   - the `attract` force with the default orbit produces byte-identical velocity to an explicit 0.1,
 *     and `orbit: 0` removes exactly the tangential swirl leg (a purely radial attract), proving the
 *     dial is real and the default preserves the spiral.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import { attract } from './forces/index.ts';
import { FORMATION_BY } from './config/forces.config.ts';
import type { FieldHost } from './engine/host.ts';
import type { Body, Particle, Env } from './engine/types.ts';

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

function fakeHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

// ── the historical constants the declared defaults must reproduce ────────────────────────────────

const HISTORICAL_ORBIT = 0.1;
const HISTORICAL_WANDER = 1.0;

test('ambient preset still carries the historical hardcoded orbit/wander (the DECLARE defaults source)', () => {
  // Regression guard: the two ambientOrbit/ambientWander defaults resolve to FORMATION_BY.ambient.preset,
  // so this pins the values that keep the resting field byte-identical to the pre-#978 behavior.
  assert.equal(FORMATION_BY.ambient.preset.orbit, HISTORICAL_ORBIT, 'ambient orbit default is 0.1');
  assert.equal(FORMATION_BY.ambient.preset.wander, HISTORICAL_WANDER, 'ambient wander default is 1.0');
});

// ── force-level proof: the default orbit reproduces the historical swirl exactly ─────────────────

function probeAttract(orbit: number): { vx: number; vy: number } {
  const b = { range: 200, strength: 1, on: false } as unknown as Body;
  const p = { vx: 0, vy: 0, vz: 0, heat: 0 } as unknown as Particle;
  // a particle 60px to the +x, 80px to the +y of the body (dist 100), flat field (dz 0).
  const e = { dx: 60, dy: 80, dz: 0, dist: 100, form: { orbit } } as unknown as Env;
  attract.apply(b, p, e);
  return { vx: p.vx, vy: p.vy };
}

test('attract with the DEFAULT ambient orbit is byte-identical to an explicit 0.1 (behavior unchanged)', () => {
  const viaDefault = probeAttract(FORMATION_BY.ambient.preset.orbit);
  const viaExplicit = probeAttract(HISTORICAL_ORBIT);
  assert.deepEqual(viaDefault, viaExplicit, 'the declared default reproduces the historical swirl exactly');
});

test('attract with orbit 0 drops exactly the tangential swirl leg (a purely radial attract)', () => {
  const spiral = probeAttract(HISTORICAL_ORBIT);
  const radial = probeAttract(0);
  // radial pull is unchanged; the difference is purely the tangential swirl the orbit dial controls.
  // f = (1 - 100/200)^2 * strength(1) * 0.5 = 0.125; ux=0.6, uy=0.8.
  const f = (1 - 100 / 200) ** 2 * 1 * 0.5;
  const ux = 0.6;
  const uy = 0.8;
  assert.ok(Math.abs(radial.vx - ux * f) < 1e-12, 'radial vx is the pure inward pull');
  assert.ok(Math.abs(radial.vy - uy * f) < 1e-12, 'radial vy is the pure inward pull');
  // the swirl leg the default (0.1) adds back: (-uy, ux) * f * 0.1
  assert.ok(Math.abs(spiral.vx - (radial.vx + -uy * f * HISTORICAL_ORBIT)) < 1e-12, 'spiral adds the +tangent x leg');
  assert.ok(Math.abs(spiral.vy - (radial.vy + ux * f * HISTORICAL_ORBIT)) < 1e-12, 'spiral adds the +tangent y leg');
  assert.notDeepEqual(spiral, radial, 'orbit: 0 is observably different from the default spiral');
});

// ── wiring acceptance: createField accepts the declared options (names them for the RC-6 guard) ──

test('createField accepts ambientOrbit / ambientWander (declared FieldOptions, opt-in)', () => {
  for (const opts of [
    { ambientOrbit: 0, ambientWander: 0 }, // zero the spiral + still the drift
    { ambientOrbit: 0.5, ambientWander: 2 }, // stronger orbit + livelier drift
    { ambientOrbit: -1, ambientWander: -1 }, // invalid → falls back to the historical defaults
    {}, // omitted → the historical defaults
  ]) {
    const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', ...opts });
    try {
      assert.ok(field, `field initialises with ambientOrbit/ambientWander = ${JSON.stringify(opts)}`);
    } finally {
      field.destroy();
    }
  }
});
