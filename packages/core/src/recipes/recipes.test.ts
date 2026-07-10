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
  validatePattern,
  serializePattern,
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
  PATTERN_TIERS,
  patternById,
} from './gallery.ts';
import { explainScene, fieldDiff } from './explain.ts';
import { compileRecipe, patternToMarkup, patternBodyAttributes, metricVar, patternAuthoring } from './compile.ts';
import { passportFor } from '../contracts/passport.ts';
import { RENDER_MODES } from '../visual/visualization.ts';
import { FUNDAMENTAL_FIELDS } from '../config/manual.ts';

test('every field recipe is valid (real tokens, known render layers + diagnostics, matching primitives)', () => {
  for (const r of FIELD_RECIPES) {
    const problems = validatePattern(r);
    assert.deepEqual(problems, [], `${r.name}: ${problems.map((p) => `${p.path} ${p.issue}`).join(', ')}`);
  }
});

test('the catalog is the canonical 64 with unique kebab ids', () => {
  assert.equal(FIELD_RECIPES.length, 64);
  assert.equal(ESSENTIAL_RECIPES, FIELD_RECIPES, 'ESSENTIAL_RECIPES is the deprecated alias of FIELD_RECIPES');
  const ids = FIELD_RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} is kebab-case`);
});

test('the four tiers (core/applied/systems/operational) each hold 16 and concatenate in order', () => {
  assert.equal(PATTERN_TIERS.length, 4);
  assert.deepEqual(PATTERN_TIERS.map((t) => t.key), ['core', 'applied', 'systems', 'operational']);
  for (const t of PATTERN_TIERS) {
    assert.equal(t.recipes.length, 16, `tier ${t.key} has 16`);
    for (const r of t.recipes) assert.equal(r.tier, t.key, `${r.id} carries tier ${t.key}`);
  }
  const flattened = PATTERN_TIERS.flatMap((t) => t.recipes);
  assert.deepEqual(flattened.map((r) => r.id), FIELD_RECIPES.map((r) => r.id), 'tiers == FIELD_RECIPES order');
});

test('every recipe carries an injected tier + status', () => {
  for (const r of FIELD_RECIPES) {
    assert.ok(r.tier, `${r.id} has a tier`);
    assert.equal(r.status, 'shipped', `${r.id} status`);
  }
});

test('no recipe primitive is ever a diagnostic, metric, concept, or condition (lanes never collapse)', () => {
  for (const r of FIELD_RECIPES)
    for (const p of r.primitives) {
      assert.ok(passportFor(p), `${r.id}: primitive "${p}" is a real runtime token`);
      assert.ok(!FIELD_MODES.has(p), `${r.id}: primitive "${p}" is not a diagnostic/render mode`);
    }
});

test('validatePattern gives a lane-aware error when a non-token slips into primitives', () => {
  const mk = (token: string): FieldRecipe =>
    ({
      id: 'x', name: 'X', intent: 'i', primitives: [token], bodies: [{ body: token }],
      render: ['particles'], metrics: [], diagnostics: [],
      accessibility: { reducedMotion: 'r', meaningWithoutMotion: 'm' },
    }) as unknown as FieldRecipe;
  assert.ok(validatePattern(mk('potential')).some((p) => p.path.startsWith('primitives') && /diagnostic/.test(p.issue)));
  assert.ok(validatePattern(mk('mass')).some((p) => p.path.startsWith('primitives') && /metric/.test(p.issue)));
  assert.ok(validatePattern(mk('orbit')).some((p) => p.path.startsWith('primitives') && /concept/.test(p.issue)));
  assert.ok(validatePattern(mk('dwell')).some((p) => p.path.startsWith('primitives') && /condition/.test(p.issue)));
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
  for (const id of FIRST_RELEASE_RECIPE_IDS) assert.ok(patternById(id), `${id} exists`);
  assert.deepEqual(FIRST_RELEASE_RECIPES.map((r) => r.id), [...FIRST_RELEASE_RECIPE_IDS]);
});

test('validatePattern rejects unknown tokens, render layers, diagnostics, and fields', () => {
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
  const problems = validatePattern(bad);
  assert.ok(problems.some((p) => /unknown force token "wormhole"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown render layer "hologram"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown diagnostic mode "mythology"/.test(p.issue)));
  assert.ok(problems.some((p) => /unknown fundamental field "mystery"/.test(p.issue)));
});

test('validatePattern flags primitives that drift from the body tokens', () => {
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
  assert.ok(validatePattern(drift).some((p) => p.path === 'primitives'));
});

test('validatePattern requires the accessibility equivalent', () => {
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
  assert.ok(validatePattern(noA11y).some((p) => p.path === 'accessibility'));
});

test('a recipe round-trips through JSON', () => {
  const r = patternById('guided-flow')!;
  const back = parseRecipe(serializePattern(r));
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
  const text = explainScene(patternById('guided-flow')!); // magnetism + fieldflow + field-lines
  assert.match(text, /magnetism/i);
  assert.match(text, /fieldflow/i);
  assert.match(text, /because of fieldflow/i);
  assert.match(text, /field-lines/);
});

test('every recipe compiles; bodies carry only real tokens; concepts never leak into the token lane', () => {
  for (const r of FIELD_RECIPES) {
    const c = compileRecipe(r);
    assert.equal(c.bodies.length, r.bodies.length, `${r.id}: body count`);
    const tokens = c.bodies.flatMap((b) => b.tokens);
    for (const t of tokens) assert.ok(passportFor(t), `${r.id}: token "${t}" is real`);
    // the metric lane becomes feedback-variable bindings
    assert.deepEqual(c.feedback.map((f) => f.metric), r.metrics, `${r.id}: feedback covers metrics`);
    for (const f of c.feedback) assert.equal(f.var, metricVar(f.metric));
    // every recipe gets a reduced-motion output plan, not just prose
    assert.ok(c.reducedMotion.staticOutputs.length > 0, `${r.id}: reduced-motion outputs`);
    assert.ok(c.reducedMotion.reducedMotion && c.reducedMotion.meaningWithoutMotion, `${r.id}: reduced-motion text`);
    // lane discipline: a concept word never appears as a runtime token
    for (const concept of r.concepts ?? []) assert.ok(!tokens.includes(concept), `${r.id}: concept "${concept}" is not a token`);
  }
});

test('accessibility conformance: every shipped recipe compiles a reduced-motion output path', () => {
  for (const r of FIELD_RECIPES) {
    const plan = compileRecipe(r).reducedMotion;
    assert.ok(plan.reducedMotion.length > 0, `${r.id}: reduced-motion behavior`);
    assert.ok(plan.meaningWithoutMotion.length > 0, `${r.id}: meaning without motion (motion is never the only source)`);
    // a real output path, not just prose: at least the reduced-motion note, plus a surface per lane present
    assert.ok(plan.staticOutputs.includes('reduced-motion-note'), `${r.id}: note`);
    if (r.metrics.length) assert.ok(plan.staticOutputs.includes('metric-badges'), `${r.id}: metric badges`);
    if ((r.relationships?.length ?? 0) > 0) assert.ok(plan.staticOutputs.includes('relationship-list'), `${r.id}: relationship list`);
  }
});

test('patternToMarkup + patternBodyAttributes emit real data-body authoring', () => {
  const gf = patternById('guided-flow')!;
  const markup = patternToMarkup(gf);
  assert.match(markup, /<field-root><\/field-root>/);
  for (const b of gf.bodies) assert.ok(markup.includes(`data-body="${b.body}"`), `markup has ${b.body}`);
  const attrs = patternBodyAttributes({ body: 'attract', strength: 1.2, range: 320, feedback: true });
  assert.equal(attrs['data-body'], 'attract');
  assert.equal(attrs['data-strength'], '1.2');
  assert.equal(attrs['data-range'], '320');
  assert.ok('data-feedback' in attrs);
});

test('patternAuthoring emits html / web-component / react surfaces with real tokens', () => {
  const a = patternAuthoring(patternById('priority-well')!);
  assert.match(a.html, /<field-root><\/field-root>/);
  assert.match(a.html, /data-body="attract"/);
  assert.match(a.webComponent, /@fundamental-engine\/elements/);
  assert.match(a.react, /@fundamental-engine\/react/);
  assert.match(a.react, /<FieldField>/);
  assert.match(a.react, /data-body="attract"/);
});

test('fieldDiff describes direction of change', () => {
  const out = fieldDiff({ entropy: 0.22, speed: 1.4 }, { entropy: 0.37, speed: 2.1 });
  assert.match(out, /Before:/);
  assert.match(out, /entropy up 0.15/);
  assert.match(out, /speed up 0.70/);
  assert.match(fieldDiff({ a: 1 }, { a: 1 }), /no change/);
});
