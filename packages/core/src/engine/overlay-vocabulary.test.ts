/**
 * One overlay vocabulary, checked in both directions (#672 lane R0, Field Surfaces program §6.1
 * **C-17**).
 *
 * Before this there were four hand-maintained copies of the same eight strings, and each one failed
 * SILENTLY when a reading was added to the union and forgotten here:
 *
 *   · `recipes/compile.ts`     → the layer landed in `unapplied`; the Pattern lost it, `check:recipes` green
 *   · `<field-root>`'s filter  → the token was dropped and the element fell back to `off`
 *   · the site's workbench     → the reading never became a control
 *   · the `check:docs` regex   → (the gate's own truth source; left reading the union deliberately)
 *
 * The compile-time half lives in `types.ts`: `satisfies` proves list ⊆ union, and
 * `OverlayListIsExhaustive` proves union ⊆ list — neither alone is enough, which is the whole of
 * C-17. This file pins the RUNTIME half: that the derived consumers really are derived, so a future
 * edit cannot quietly reintroduce a fifth copy that happens to agree today.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAY_MODE_LIST, OVERLAY_READING_LIST } from './types.ts';
import { patternRenderPlan } from '../recipes/compile.ts';

test('the list is the union: `off` plus every reading, in declaration order, no duplicates', () => {
  assert.equal(OVERLAY_MODE_LIST[0], 'off', '`off` leads — it is the absence of a reading, not one');
  assert.equal(new Set(OVERLAY_MODE_LIST).size, OVERLAY_MODE_LIST.length, 'no duplicates');
  assert.deepEqual(
    [...OVERLAY_READING_LIST].sort(),
    [...OVERLAY_MODE_LIST].filter((m) => m !== 'off').sort(),
    'the reading list is exactly the vocabulary minus `off`',
  );
  assert.ok(!OVERLAY_READING_LIST.includes('off' as never), '`off` is never a reading');
});

test('every reading survives the Pattern render plan — none lands in `unapplied`', () => {
  // This is the consumer that used to drop a forgotten reading silently. Driving EVERY reading
  // through it means a new one cannot join the union without this test exercising it.
  for (const reading of OVERLAY_READING_LIST) {
    const plan = patternRenderPlan([reading]);
    assert.ok(
      !plan.unapplied.includes(reading),
      `"${reading}" is a real reading but the render plan dropped it into unapplied — the vocabulary drifted`,
    );
  }
});

test('and each one is routed to the OVERLAY, not quietly swallowed somewhere else', () => {
  // `unapplied` being empty is not enough: a reading that vanished into neither list would also
  // pass the test above. `streamlines` is the one deliberate exception — it is a real underlay
  // render mode too, and the plan prefers the underlay when it is the pattern's only layer.
  for (const reading of OVERLAY_READING_LIST) {
    const plan = patternRenderPlan([reading]);
    const placed = plan.overlay.includes(reading) || plan.underlay === reading;
    assert.ok(placed, `"${reading}" reached neither the overlay stack nor the underlay: ${JSON.stringify(plan)}`);
  }
});

test('an invented reading still lands in `unapplied` — the checks above are not vacuous', () => {
  // Without this, both tests would pass just as well if `unapplied` were never populated at all.
  const plan = patternRenderPlan(['not-a-reading']);
  assert.ok(plan.unapplied.includes('not-a-reading'), 'unknown layers are still reported');
  assert.ok(!plan.overlay.includes('not-a-reading' as never), 'and are not routed to the overlay');
});
