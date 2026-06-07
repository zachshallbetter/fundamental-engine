/**
 * Authoring & recipe tests (Phase 7). Recipes validate against real forces and round-trip through
 * JSON; the intent compiler emits passported tokens; explain/diff produce sane prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, serializeRecipe, parseRecipe, type SceneRecipe } from './schema.ts';
import { compileIntent, knownIntents, INTENT_PRESETS } from './intent.ts';
import { ESSENTIAL_RECIPES } from './gallery.ts';
import { explainScene, fieldDiff } from './explain.ts';
import { passportFor } from '../contracts/passport.ts';

test('every essential recipe is valid (real tokens, known render layers)', () => {
  for (const r of ESSENTIAL_RECIPES) {
    const problems = validateRecipe(r);
    assert.deepEqual(problems, [], `${r.name}: ${problems.map((p) => `${p.path} ${p.issue}`).join(', ')}`);
  }
});

test('validateRecipe rejects unknown tokens and render layers', () => {
  const bad: SceneRecipe = { name: 'X', intent: 'i', bodies: [{ body: 'wormhole' }], render: ['hologram' as never], metrics: [] };
  const problems = validateRecipe(bad);
  assert.ok(problems.some((p) => /unknown force token "wormhole"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown render layer "hologram"/.test(p.issue)));
});

test('a recipe round-trips through JSON', () => {
  const r = ESSENTIAL_RECIPES[3]!; // Solar Prominence
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
  const text = explainScene(ESSENTIAL_RECIPES[3]!); // Solar Prominence
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
