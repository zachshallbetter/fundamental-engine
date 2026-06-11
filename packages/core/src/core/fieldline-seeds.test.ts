/**
 * Field-line seeds — the seeds must come from each body's real field geometry: a monopole ring for
 * charge/gravity, the dipole's perpendicular bisector for a magnet, and NOTHING for a body that
 * radiates no field (so the diagram stays the structure, never a starburst over a neighbour).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dipoleSeeds, monopoleSeeds, type SeedBody } from './fieldlines.ts';
import { fieldLineSeeds, FIELD_BEARING_TOKENS } from './fieldline-seeds.ts';

const body = (o: Partial<SeedBody> = {}): SeedBody => ({
  cx: 500, cy: 500, hw: 40, hh: 30, ux: 1, uy: 0, spin: 1, range: 300, tokens: ['gravity'], vis: true, ...o,
});

test('the field-bearing set is exactly gravity, charge, magnetism', () => {
  assert.deepEqual([...FIELD_BEARING_TOKENS].sort(), ['charge', 'gravity', 'magnetism']);
});

test('a gravity (monopole) body seeds a tight ring of radial spokes', () => {
  const b = body({ tokens: ['gravity'] });
  const seeds = monopoleSeeds(b);
  assert.equal(seeds.length, 18, 'a full ring of seeds');
  const r0 = Math.max(Math.min(b.hw, b.hh) * 0.8, 24);
  for (const s of seeds) {
    assert.ok(Math.abs(Math.hypot(s.x - b.cx, s.y - b.cy) - r0) < 1e-9, 'every seed sits on the core ring');
  }
});

test('a magnetism (dipole) body seeds the perpendicular bisector: centre + rings either side', () => {
  const b = body({ tokens: ['magnetism'], spin: 1, ux: 1, uy: 0 });
  const seeds = dipoleSeeds(b, 8);
  assert.equal(seeds.length, 1 + 2 * 8, 'the central axial seed plus a pair per ring');
  assert.ok(seeds.some((s) => s.x === b.cx && s.y === b.cy), 'the central axial line is seeded');
  // the heading is +x, so the bisector is the y axis through the core: offsets are pure ±y
  for (const s of seeds) assert.ok(Math.abs(s.x - b.cx) < 1e-9, 'offsets lie on the perpendicular bisector');
});

test('fieldLineSeeds dispatches by token and skips bodies that radiate nothing', () => {
  const grav = body({ cx: 100, tokens: ['gravity'] });
  const mag = body({ cx: 900, tokens: ['magnetism'] });
  const attract = body({ cx: 500, tokens: ['attract'] }); // no field() → no seeds
  const hidden = body({ cx: 700, tokens: ['gravity'], vis: false }); // invisible → no seeds
  const seeds = fieldLineSeeds([grav, mag, attract, hidden]);
  assert.equal(seeds.length, monopoleSeeds(grav).length + dipoleSeeds(mag).length, 'only the two field-bearing, visible bodies seed');
  assert.ok(seeds.every((s) => s.x < 200 || s.x > 800), 'no seeds near the attract/hidden bodies in the middle/right');
});

test('charge seeds as a monopole, exactly like gravity', () => {
  const charge = body({ tokens: ['charge'] });
  assert.deepEqual(fieldLineSeeds([charge]), monopoleSeeds(charge));
});
