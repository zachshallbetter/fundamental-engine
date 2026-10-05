/**
 * One render vocabulary (#1218) — the render-mode half of the same problem #1215 fixed for overlay
 * readings, and the worse half.
 *
 * There were five hand-maintained copies, and each failed differently and silently: a mode missing
 * from `FieldOptions.render` was rejected at construction, missing from the `<field-root>` chain was
 * filtered out and quietly downgraded to `none`, missing from `compile.ts` was dropped from a
 * Pattern's plan with `check:recipes` green.
 *
 * The compile-time half lives in `types.ts` — `satisfies` proves list ⊆ union, and
 * `RenderListIsExhaustive` proves union ⊆ list. This pins the runtime half.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_MODE_LIST } from './types.ts';
import { patternRenderPlan } from '../recipes/compile.ts';

test('the list is complete, ordered, and free of duplicates', () => {
  assert.equal(new Set(RENDER_MODE_LIST).size, RENDER_MODE_LIST.length, 'no duplicates');
  assert.ok(RENDER_MODE_LIST.includes('none'), '`none` is part of the vocabulary — it is a valid mode');
  assert.ok(RENDER_MODE_LIST.includes('dots'), 'and so is the default drawing mode');
  assert.equal(RENDER_MODE_LIST.at(-1), 'none', '`none` sorts last, as it reads in the union');
});

test('every mode routes exactly where it did before the vocabulary was unified', () => {
  // The consumer that used to drop a forgotten mode into `unapplied`. Pinned as an exact table
  // rather than "is it routed somewhere", because the EXCLUSIONS carry as much meaning as the
  // inclusions: the first draft of this test only asserted that modes were routed, and emptying the
  // exclusion set left it green while `flow` and `none` silently became matter layers.
  //
  // `flow` is deliberately unrouted: it is a real render mode (dots AND streamlines in one underlay)
  // with no Pattern-lane counterpart, so a Pattern declaring it names a layer the plan cannot apply.
  const expected: Record<string, 'underlay' | 'unapplied'> = {
    dots: 'underlay', trails: 'underlay', links: 'underlay', metaballs: 'underlay',
    voronoi: 'underlay', knockout: 'underlay', redshift: 'underlay', blackbody: 'underlay',
    depth: 'underlay',
    streamlines: 'underlay', // its own branch: prefers the overlay unless it is the only layer
    flow: 'unapplied',
    none: 'unapplied',
  };
  assert.deepEqual(
    [...RENDER_MODE_LIST].sort(),
    Object.keys(expected).sort(),
    'the table covers the vocabulary exactly — a new mode must be classified here, not defaulted',
  );
  for (const mode of RENDER_MODE_LIST) {
    const plan = patternRenderPlan([mode]);
    const where = plan.underlay === mode ? 'underlay' : plan.unapplied.includes(mode) ? 'unapplied' : 'elsewhere';
    assert.equal(where, expected[mode], `"${mode}" routes to ${where}, expected ${expected[mode]}`);
  }
});

test('an invented mode still lands in `unapplied` — the check above is not vacuous', () => {
  const plan = patternRenderPlan(['not-a-render-mode']);
  assert.ok(plan.unapplied.includes('not-a-render-mode'));
  assert.equal(plan.underlay, null, 'and is not silently promoted to the underlay');
});

test('`particles` stays a matter layer although it is not a render mode', () => {
  // The Pattern lane's name for the base swarm. It has no render-mode counterpart, so the derivation
  // adds it explicitly — and forgetting that would break every Pattern in the catalog at once.
  assert.ok(!RENDER_MODE_LIST.includes('particles' as never), 'not part of the render vocabulary');
  assert.equal(patternRenderPlan(['particles']).unapplied.includes('particles'), false, 'but still a layer');
});
