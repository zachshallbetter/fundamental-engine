/**
 * The executable render plan (#370): recipe.render stops being descriptive — compileRecipe maps
 * declared layers onto the Field Surfaces (one underlay matter mode, the additive overlay reading
 * stack, the heatmap toggle), and anything with no executable surface is NAMED in `unapplied`,
 * never silently dropped. Plus the new per-body `when` gate validation: an unknown condition id
 * is a validation error, not a gate that silently never passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeRenderPlan } from './compile.ts';
import { validateRecipe } from './schema.ts';
import type { FieldRecipe } from './schema.ts';

test('matter + overlay + heatmap split onto their surfaces', () => {
  assert.deepEqual(recipeRenderPlan(['particles', 'streamlines', 'heatmap']), {
    underlay: 'dots',
    overlay: ['streamlines'],
    heatmap: true,
    unapplied: [],
  });
});

test('one underlay only — a second matter mode is named, not silently dropped', () => {
  const plan = recipeRenderPlan(['trails', 'metaballs', 'field-lines']);
  assert.equal(plan.underlay, 'trails');
  assert.deepEqual(plan.overlay, ['field-lines']);
  assert.deepEqual(plan.unapplied, ['metaballs']);
});

test('streamlines alone serves as the underlay render mode; with matter it reads over content', () => {
  assert.equal(recipeRenderPlan(['streamlines']).underlay, 'streamlines');
  assert.deepEqual(recipeRenderPlan(['streamlines']).overlay, []);
  const both = recipeRenderPlan(['dots', 'streamlines']);
  assert.equal(both.underlay, 'dots');
  assert.deepEqual(both.overlay, ['streamlines']);
});

test('an unknown body.when gate is a validation error — never a silent never-passes gate', () => {
  const r: FieldRecipe = {
    id: 'x', name: 'X', intent: 'i',
    primitives: ['attract'],
    bodies: [{ body: 'attract', when: 'engaged' }], // not a registered condition id
    render: ['particles'], metrics: [], diagnostics: [],
    accessibility: { reducedMotion: 'static', meaningWithoutMotion: 'static' },
  };
  const problems = validateRecipe(r);
  assert.ok(problems.some((p) => p.path === 'bodies[0].when' && /unknown condition/.test(p.issue)), JSON.stringify(problems));
  r.bodies[0]!.when = 'active';
  assert.deepEqual(validateRecipe(r), []);
});
