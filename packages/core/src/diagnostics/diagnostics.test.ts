/**
 * Diagnostics tests (B4). All pure: energy accounting, potential sign/shape, scalar grid sampling,
 * probe force-vectors (the "field magnitude != force magnitude" rule), causality decomposition, and
 * heatmap-variant accumulation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Body, Particle, ForceRegistry } from '../core/types.ts';
import { kineticEnergy, thermalEnergy, energyReport, energyDrift } from './energy.ts';
import { potentialAt, netPotentialAt, sampleScalarGrid } from './potential.ts';
import { forceVectorAt, causalityAt, PROBE_PRESETS } from './probes.ts';
import { accumulateHeatmap, HEATMAP_SAMPLERS } from './fields.ts';
import { attract } from '../forces/index.ts';
import { magnetism, charge } from '../forces/natural.ts';

const particle = (o: Partial<Particle> = {}): Particle =>
  ({ x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...o }) as Particle;
const body = (o: Partial<Body> = {}): Body =>
  ({ cx: 100, cy: 0, M: 2000, strength: 1, range: 300, spin: 1, on: false, ...o }) as unknown as Body;

test('energy: kinetic, thermal, total, drift', () => {
  const ps = [particle({ vx: 2, vy: 0 }), particle({ vx: 0, vy: 0, heat: 0.5 })];
  assert.equal(kineticEnergy(ps), 2); // ½·1·4 + 0
  assert.equal(thermalEnergy(ps), 0.5);
  assert.equal(energyReport(ps).total, 2.5);
  assert.equal(energyDrift(2, 2.2).toFixed(2), '0.10');
});

test('potential: gravity is an attractive (negative) well; charge is signed; grid samples', () => {
  const near = potentialAt(body(), 90, 0, 'gravity');
  const far = potentialAt(body(), 0, 0, 'gravity');
  assert.ok(near < 0 && far < 0, 'gravity potential is negative');
  assert.ok(near < far, 'deeper (more negative) closer to the mass');
  assert.ok(potentialAt(body({ spin: 1 }), 0, 0, 'charge') > 0, 'positive polarity → positive potential');
  assert.ok(potentialAt(body({ spin: -1 }), 0, 0, 'charge') < 0, 'negative polarity → negative potential');
  const g = sampleScalarGrid((x, y) => netPotentialAt([body()], x, y), 200, 100, 50);
  assert.equal(g.cols, 4);
  assert.equal(g.rows, 2);
  assert.equal(g.values.length, 8);
});

test('force vectors via probes: attract pulls toward the body; magnitude depends on the probe', () => {
  const v = forceVectorAt(attract, body({ cx: 100, cy: 0 }), 0, 0);
  assert.ok(v.x > 0, 'attract pulls toward +x (the body)');
  // magnetism does nothing to a STILL probe (needs velocity) but curves a MOVING one
  const still = forceVectorAt(magnetism, body(), 50, 0, PROBE_PRESETS.still);
  assert.ok(Math.hypot(still.x, still.y) < 1e-9, 'a strong field exerts no force on a still charge');
  const moving = forceVectorAt(magnetism, body(), 50, 0, PROBE_PRESETS.positive);
  assert.ok(Math.hypot(moving.x, moving.y) > 0, 'a moving charge curves');
  // charge ignores neutral matter
  assert.ok(Math.hypot(...Object.values(forceVectorAt(charge, body(), 50, 0, PROBE_PRESETS.neutral)) as [number, number]) < 1e-9);
});

test('causality decomposes motion per token', () => {
  const registry = { attract, magnetism } as unknown as ForceRegistry;
  const contribs = causalityAt(registry, ['attract', 'magnetism'], body(), 0, 0, PROBE_PRESETS.positive);
  assert.equal(contribs.length, 2);
  assert.ok(contribs.find((c) => c.token === 'attract'));
});

test('heatmap variants accumulate the chosen scalar', () => {
  assert.equal(HEATMAP_SAMPLERS.density(particle()), 1);
  assert.equal(HEATMAP_SAMPLERS.heat(particle({ heat: 0.7 })), 0.7);
  assert.equal(HEATMAP_SAMPLERS.velocity(particle({ vx: 3, vy: 4 })), 5);
  const grid = accumulateHeatmap([particle({ x: 10, y: 10 }), particle({ x: 12, y: 11 })], 'density', 100, 100, 20);
  assert.equal(grid.peak, 2, 'both land in the same cell');
});
