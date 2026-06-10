/**
 * The Wayfinding Field variations — experimental nav-chrome recipes. They must be conformance-clean
 * exactly like the gallery (real tokens, known render layers + diagnostics, primitives = body tokens,
 * a fundamental field, a reduced-motion equivalent), compile to a runtime plan, and round-trip — but
 * stay OUT of the canonical 64 so the gallery's 4×16 numerology is undisturbed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, serializeRecipe, parseRecipe, primitivesOf, FIELD_MODES } from './schema.ts';
import { WAYFINDING_FIELD, WAYFINDING_CURRENT, WAYFINDING_RECIPES, EXPERIMENTAL_RECIPES } from './wayfinding.ts';
import { FIELD_RECIPES } from './gallery.ts';
import { compileRecipe, metricVar } from './compile.ts';
import { passportFor } from '../contracts/passport.ts';

test('both wayfinding variations validate (real tokens, known layers + diagnostics, matching primitives)', () => {
  for (const r of WAYFINDING_RECIPES) {
    const problems = validateRecipe(r);
    assert.deepEqual(problems, [], `${r.name}: ${problems.map((p) => `${p.path} ${p.issue}`).join(', ')}`);
    assert.deepEqual(r.primitives, primitivesOf(r.bodies), `${r.name}: primitives match body tokens`);
  }
});

test('no wayfinding primitive is ever a diagnostic / render mode (lanes never collapse)', () => {
  for (const r of WAYFINDING_RECIPES)
    for (const p of r.primitives) {
      assert.ok(passportFor(p), `${r.id}: primitive "${p}" is a real runtime token`);
      assert.ok(!FIELD_MODES.has(p), `${r.id}: primitive "${p}" is not a diagnostic/render mode`);
    }
});

test('the two variations are genuinely distinct — different natural field, forces, and lead metric', () => {
  assert.notEqual(WAYFINDING_FIELD.naturalField, WAYFINDING_CURRENT.naturalField);
  assert.equal(WAYFINDING_FIELD.naturalField, 'gravity');
  assert.equal(WAYFINDING_CURRENT.naturalField, 'electromagnetic');
  // no shared primitive between the two compositions
  const shared = WAYFINDING_FIELD.primitives.filter((p) => WAYFINDING_CURRENT.primitives.includes(p));
  assert.deepEqual(shared, [], `expected no shared force token, got: ${shared.join(', ')}`);
});

test('both are experimental and kept OUT of the canonical 64', () => {
  assert.equal(EXPERIMENTAL_RECIPES, WAYFINDING_RECIPES, 'EXPERIMENTAL_RECIPES is the surfaced alias');
  for (const r of WAYFINDING_RECIPES) assert.equal(r.status, 'experimental', `${r.id} is experimental`);
  for (const r of WAYFINDING_RECIPES)
    assert.ok(!FIELD_RECIPES.some((g) => g.id === r.id), `${r.id} is not in FIELD_RECIPES`);
  assert.equal(FIELD_RECIPES.length, 64, 'the gallery stays a locked 64');
});

test('both compile to a runtime plan with metric feedback and a reduced-motion output', () => {
  for (const r of WAYFINDING_RECIPES) {
    const c = compileRecipe(r);
    assert.equal(c.bodies.length, r.bodies.length, `${r.id}: body count`);
    for (const t of c.bodies.flatMap((b) => b.tokens)) assert.ok(passportFor(t), `${r.id}: token "${t}" is real`);
    assert.deepEqual(c.feedback.map((f) => f.metric), r.metrics, `${r.id}: feedback covers metrics`);
    for (const f of c.feedback) assert.equal(f.var, metricVar(f.metric));
    assert.ok(c.reducedMotion.staticOutputs.length > 0, `${r.id}: reduced-motion outputs`);
  }
});

test('both round-trip through JSON', () => {
  for (const r of WAYFINDING_RECIPES) assert.deepEqual(parseRecipe(serializeRecipe(r)), r);
});
