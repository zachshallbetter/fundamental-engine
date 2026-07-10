/**
 * Gravity Field — conformance for the natural-field gravity preset. Same bar as the wayfinding pair
 * and contour-charge: real tokens, known layers + diagnostics, primitives = body tokens, a
 * fundamental field, reduced-motion equivalents, compiles, round-trips — and stays OUT of the 64.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePattern, serializePattern, parseRecipe, primitivesOf, FIELD_MODES } from './schema.ts';
import { GRAVITY_FIELD, GRAVITY_RECIPES } from './gravity.ts';
import { EXPERIMENTAL_RECIPES } from './wayfinding.ts';
import { FIELD_RECIPES, patternById } from './catalog.ts';
import { compileRecipe } from './compile.ts';
import { passportFor } from '../contracts/passport.ts';

test('gravity-field validates: real tokens, known layers, primitives match body tokens', () => {
  const problems = validatePattern(GRAVITY_FIELD);
  assert.deepEqual(problems, [], problems.map((p) => `${p.path} ${p.issue}`).join(', '));
  assert.deepEqual(GRAVITY_FIELD.primitives, primitivesOf(GRAVITY_FIELD.bodies));
  for (const p of GRAVITY_FIELD.primitives) {
    assert.ok(passportFor(p), `primitive "${p}" is a real runtime token`);
    assert.ok(!FIELD_MODES.has(p), `primitive "${p}" is not a render/diagnostic mode`);
  }
});

test('the lane rule holds: gravity and swirl stay force tokens, no recipe claims those words', () => {
  assert.equal(GRAVITY_FIELD.id, 'gravity-field');
  assert.ok(passportFor('gravity') && passportFor('swirl'), 'both stay real force tokens');
  assert.ok(!FIELD_RECIPES.some((r) => r.id === 'gravity' || r.id === 'swirl'), 'no recipe claims a token word');
});

test('it is built on the real natural field: gravity, with orbital threading from swirl', () => {
  assert.equal(GRAVITY_FIELD.naturalField, 'gravity');
  assert.deepEqual([...GRAVITY_FIELD.primitives].sort(), ['gravity', 'swirl']);
  assert.equal(GRAVITY_FIELD.bodies.length, 1, 'one well carries both tokens');
});

test('registered experimentally: in EXPERIMENTAL_RECIPES, resolvable by id, outside the 64', () => {
  assert.ok(EXPERIMENTAL_RECIPES.some((r) => r.id === 'gravity-field'));
  assert.equal(patternById('gravity-field'), GRAVITY_FIELD);
  assert.ok(!FIELD_RECIPES.includes(GRAVITY_FIELD), 'the canonical 64 is undisturbed');
  assert.equal(FIELD_RECIPES.length, 64, 'the gallery stays a locked 64');
  assert.equal(GRAVITY_RECIPES.length, 1);
});

test('compiles to a plan that traces the field lines over the particle underlay, and round-trips', () => {
  const plan = compileRecipe(GRAVITY_FIELD);
  assert.equal(plan.bodies.length, 1, 'one well body');
  assert.deepEqual(plan.bodies[0]!.tokens.sort(), ['gravity', 'swirl'], 'the well carries both tokens');
  assert.ok(plan.render.overlay.includes('field-lines'), 'the field-lines reading is in the overlay stack');
  assert.deepEqual(parseRecipe(serializePattern(GRAVITY_FIELD)), GRAVITY_FIELD);
});
