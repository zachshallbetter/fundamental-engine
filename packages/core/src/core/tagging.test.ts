/**
 * Matter tagging (FieldKit gap #7): a body's `affects` set restricts its forces to matter of those
 * species, so multiple ecologies (pollen vs seeds vs spores) share one field. Pins the integrator
 * filter: an `affects` body pulls only its species and skips the rest; no `affects` ⇒ acts on all
 * (back-compat).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step } from './integrator.ts';
import { FieldStore } from './field-store.ts';
import { createRegistry } from './registry.ts';
import { registerCoreForces } from '../forces/index.ts';
import type { Body, Env, Particle } from './types.ts';

const reg = createRegistry();
registerCoreForces(reg);

const env = (): Env =>
  ({
    dx: 0, dy: 0, dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W: 1000, H: 800, t: 0, frameN: 1, dt: 1, c: 12, G: 1,
    spark: () => {}, supernova: () => {}, spawn: () => {}, neighbors: () => [],
    grid: () => ({ deposit: () => {}, sample: () => 0, gradient: () => ({ x: 0, y: 0 }) }) as never,
  }) as Env;

function attractWell(affects?: Set<number>): Body {
  return {
    el: {} as HTMLElement, tokens: ['attract'], strength: 2, range: 800, absorbR: 64, capacity: 60,
    spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '', M: 2,
    cx: 500, cy: 400, hw: 20, hh: 20, on: false, vis: true, accreted: 0, count: 0, d: 0,
    ...(affects ? { affects } : {}),
  } as Body;
}

const part = (species?: number): Particle =>
  ({ x: 100, y: 400, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...(species != null ? { species } : {}) }) as Particle;

test('an affects body pulls only its species; other matter is untouched', () => {
  const store = new FieldStore();
  const pollen = part(1);
  const seed = part(0);
  store.add(pollen);
  store.add(seed);
  step({ store, bodies: [attractWell(new Set([1]))], env: env(), forces: reg.forces, conditions: reg.conditions });
  assert.ok(pollen.vx > 0, 'species 1 is pulled toward the well (+x)');
  assert.ok(Math.abs(seed.vx) < 1e-9, 'species 0 is skipped entirely');
});

test('no affects → the body acts on all matter (back-compat)', () => {
  const store = new FieldStore();
  const a = part(1);
  const b = part(0);
  store.add(a);
  store.add(b);
  step({ store, bodies: [attractWell()], env: env(), forces: reg.forces, conditions: reg.conditions });
  assert.ok(a.vx > 0 && b.vx > 0, 'both species pulled when affects is unset');
});
