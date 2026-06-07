/**
 * Authoring & recipe tests (Phase 7). The 16 field recipes validate against real forces, render
 * layers, diagnostics, and fundamental fields; declared primitives match their body tokens; recipes
 * round-trip through JSON; the intent compiler emits passported tokens; explain/diff produce sane
 * prose. The recipe gallery is the four-field model made practical, so it must never drift from the
 * engine catalog.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRecipe,
  serializeRecipe,
  parseRecipe,
  primitivesOf,
  FIELD_MODES,
  type FieldRecipe,
} from './schema.ts';
import { compileIntent, knownIntents, INTENT_PRESETS } from './intent.ts';
import {
  FIELD_RECIPES,
  ESSENTIAL_RECIPES,
  FIRST_RELEASE_RECIPE_IDS,
  FIRST_RELEASE_RECIPES,
  recipeById,
} from './gallery.ts';
import { explainScene, fieldDiff } from './explain.ts';
import { passportFor } from '../contracts/passport.ts';
import { RENDER_MODES } from '../visual/visualization.ts';
import { FUNDAMENTAL_FIELDS } from '../config/manual.ts';

test('every field recipe is valid (real tokens, known render layers + diagnostics, matching primitives)', () => {
  for (const r of FIELD_RECIPES) {
    const problems = validateRecipe(r);
    assert.deepEqual(problems, [], `${r.name}: ${problems.map((p) => `${p.path} ${p.issue}`).join(', ')}`);
  }
});

test('the gallery is the canonical 16 with unique kebab ids', () => {
  assert.equal(FIELD_RECIPES.length, 16);
  assert.equal(ESSENTIAL_RECIPES, FIELD_RECIPES, 'ESSENTIAL_RECIPES is the deprecated alias of FIELD_RECIPES');
  const ids = FIELD_RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} is kebab-case`);
});

test('declared primitives match the distinct body tokens for every recipe', () => {
  for (const r of FIELD_RECIPES)
    assert.deepEqual(r.primitives, primitivesOf(r.bodies), `${r.name}: primitives match body tokens`);
});

test('every recipe natural field (when set) is one of the four fundamental fields', () => {
  for (const r of FIELD_RECIPES)
    if (r.naturalField !== undefined)
      assert.ok(FUNDAMENTAL_FIELDS.includes(r.naturalField), `${r.name}: ${r.naturalField} is fundamental`);
});

test('every recipe declares a reduced-motion + meaning-without-motion equivalent', () => {
  for (const r of FIELD_RECIPES) {
    assert.ok(r.accessibility.reducedMotion, `${r.name}: reducedMotion`);
    assert.ok(r.accessibility.meaningWithoutMotion, `${r.name}: meaningWithoutMotion`);
  }
});

test('FIELD_MODES covers every render mode in the visualization catalog', () => {
  for (const m of RENDER_MODES) assert.ok(FIELD_MODES.has(m.mode), `${m.mode} is a recipe-referenceable mode`);
  // FIELD_MODES adds only 'particles' (the base layer, not a render-mode catalog row).
  const extra = [...FIELD_MODES].filter((m) => !RENDER_MODES.some((rm) => rm.mode === m));
  assert.deepEqual(extra, ['particles'], 'FIELD_MODES = RENDER_MODES + particles');
});

test('the first-release set is eight recipes that all resolve', () => {
  assert.equal(FIRST_RELEASE_RECIPE_IDS.length, 8);
  assert.equal(FIRST_RELEASE_RECIPES.length, 8);
  for (const id of FIRST_RELEASE_RECIPE_IDS) assert.ok(recipeById(id), `${id} exists`);
  assert.deepEqual(FIRST_RELEASE_RECIPES.map((r) => r.id), [...FIRST_RELEASE_RECIPE_IDS]);
});

test('validateRecipe rejects unknown tokens, render layers, diagnostics, and fields', () => {
  const bad = {
    id: 'x',
    name: 'X',
    intent: 'i',
    naturalField: 'mystery',
    primitives: ['wormhole'],
    bodies: [{ body: 'wormhole' }],
    render: ['hologram'],
    metrics: [],
    diagnostics: ['mythology'],
    accessibility: { reducedMotion: 'r', meaningWithoutMotion: 'm' },
  } as unknown as FieldRecipe;
  const problems = validateRecipe(bad);
  assert.ok(problems.some((p) => /unknown force token "wormhole"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown render layer "hologram"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown diagnostic mode "mythology"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown fundamental field "mystery"/.test(p.issue)));
});

test('validateRecipe flags primitives that drift from the body tokens', () => {
  const drift = {
    id: 'drift',
    name: 'Drift',
    intent: 'i',
    primitives: ['attract', 'swirl'], // swirl is not a body token
    bodies: [{ body: 'attract' }],
    render: ['particles'],
    metrics: [],
    diagnostics: [],
    accessibility: { reducedMotion: 'r', meaningWithoutMotion: 'm' },
  } as FieldRecipe;
  assert.ok(validateRecipe(drift).some((p) => p.path === 'primitives'));
});

test('validateRecipe requires the accessibility equivalent', () => {
  const noA11y = {
    id: 'na',
    name: 'No a11y',
    intent: 'i',
    primitives: ['attract'],
    bodies: [{ body: 'attract' }],
    render: ['particles'],
    metrics: [],
    diagnostics: [],
  } as unknown as FieldRecipe;
  assert.ok(validateRecipe(noA11y).some((p) => p.path === 'accessibility'));
});

test('a recipe round-trips through JSON', () => {
  const r = recipeById('guided-flow')!;
  const back = parseRecipe(serializeRecipe(r));
  assert.deepEqual(back, r);
});

test('intent compiler emits real, passported tokens for every preset', () => {
  for (const name of knownIntents()) {
    const c = compileIntent(name);
    assert.ok(c, `${name} compiles`);
    for (const t of c.body.split(/\s+/)) assert.ok(passportFor(t), `${name} → "${t}" is a real force`);
  }
  assert.equal(compileIntent('not-an-intent'), null, 'unknown intent returns null');
});

test('compileIntent applies intensity, range, feedback, and high-risk thermal', () => {
  const c = compileIntent('draw-focus', { intensity: 0.8 })!;
  assert.equal(c.attributes['data-body'], 'attract');
  assert.equal(c.attributes['data-strength'], '0.8');
  assert.equal(c.attributes['data-range'], '280');
  assert.ok('data-feedback' in c.attributes);
  const risky = compileIntent('draw-focus', { risk: 'high' })!;
  assert.ok(risky.body.includes('thermal'), 'high risk adds a thermal warning layer');
  // sanity: the table only references real forces
  for (const preset of Object.values(INTENT_PRESETS))
    for (const t of preset.body) assert.ok(passportFor(t), `${t} is real`);
});

test('explainScene names the forces and the fieldflow transport caveat', () => {
  const text = explainScene(recipeById('guided-flow')!); // magnetism + fieldflow + field-lines
  assert.match(text, /magnetism/i);
  assert.match(text, /fieldflow/i);
  assert.match(text, /because of fieldflow/i);
  assert.match(text, /field-lines/);
});

test('fieldDiff describes direction of change', () => {
  const out = fieldDiff({ entropy: 0.22, speed: 1.4 }, { entropy: 0.37, speed: 2.1 });
  assert.match(out, /Before:/);
  assert.match(out, /entropy up 0.15/);
  assert.match(out, /speed up 0.70/);
  assert.match(fieldDiff({ a: 1 }, { a: 1 }), /no change/);
});
