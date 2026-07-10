/**
 * Contour Charge — conformance for the attention-charged vessel recipe (#365). Same bar as the
 * wayfinding pair: real tokens, known layers + diagnostics, primitives = body tokens, a fundamental
 * field, reduced-motion equivalents, compiles, round-trips — and stays OUT of the canonical 64.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePattern, serializePattern, parseRecipe, primitivesOf, FIELD_MODES } from './schema.ts';
import { CONTOUR_CHARGE, CHARGE_RECIPES } from './charge.ts';
import { EXPERIMENTAL_RECIPES } from './wayfinding.ts';
import { FIELD_RECIPES, patternById } from './catalog.ts';
import { compileRecipe } from './compile.ts';
import { passportFor } from '../contracts/passport.ts';

test('contour-charge validates: real tokens, known layers, primitives match body tokens', () => {
  const problems = validatePattern(CONTOUR_CHARGE);
  assert.deepEqual(problems, [], problems.map((p) => `${p.path} ${p.issue}`).join(', '));
  assert.deepEqual(CONTOUR_CHARGE.primitives, primitivesOf(CONTOUR_CHARGE.bodies));
  for (const p of CONTOUR_CHARGE.primitives) {
    assert.ok(passportFor(p), `primitive "${p}" is a real runtime token`);
    assert.ok(!FIELD_MODES.has(p), `primitive "${p}" is not a render/diagnostic mode`);
  }
});

test('the lane rule holds: the recipe is contour-charge, never bare "charge" (the token)', () => {
  assert.equal(CONTOUR_CHARGE.id, 'contour-charge');
  assert.ok(passportFor('charge'), 'charge stays the electric force token');
  assert.ok(!FIELD_RECIPES.some((r) => r.id === 'charge'), 'no recipe claims the token word');
});

test('registered experimentally: in EXPERIMENTAL_RECIPES, resolvable by id, outside the 64', () => {
  assert.ok(EXPERIMENTAL_RECIPES.some((r) => r.id === 'contour-charge'));
  assert.equal(patternById('contour-charge'), CONTOUR_CHARGE);
  assert.ok(!FIELD_RECIPES.includes(CONTOUR_CHARGE), 'the canonical 64 is undisturbed');
  assert.equal(CHARGE_RECIPES.length, 1);
});

test('compiles and round-trips', () => {
  const plan = compileRecipe(CONTOUR_CHARGE);
  assert.ok(plan.bodies.length === 1, 'one vessel body');
  assert.deepEqual(parseRecipe(serializePattern(CONTOUR_CHARGE)), CONTOUR_CHARGE);
});

test('the recipe is self-executing: the vessel body compiles with its data-when gate (#370)', () => {
  const plan = compileRecipe(CONTOUR_CHARGE);
  assert.equal(plan.bodies[0]!.attributes['data-when'], 'active');
  assert.deepEqual(plan.render, { underlay: 'dots', overlay: [], heatmap: true, unapplied: [] });
});
