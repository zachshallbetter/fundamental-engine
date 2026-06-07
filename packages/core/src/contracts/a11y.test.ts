/**
 * Accessibility test set (testing-and-conformance §10, system-contracts §14). Consolidates the
 * accessibility guarantees the Accessibility Contract requires: a reduced-motion fallback exists and
 * is enforced, meaning survives without motion, field events are thresholded (don't spam AT), color
 * is not the sole carrier, and the contract itself is published.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setContractChecks, assertReducedMotionFallback, FieldUIError } from './guards.ts';
import { CONTRACTS } from './index.ts';
import { runVisualLint } from '../visual/lint.ts';
import { emission } from '../visual/channels.ts';
import { createUserAgent, updateUserAgent, userFieldSource } from '../agents/user-agent.ts';
import { Thresholder, FIELD_EVENTS } from '../agents/event-agent.ts';

setContractChecks(true);

test('reduced-motion fallback is required (enforced by guard)', () => {
  assert.doesNotThrow(() => assertReducedMotionFallback(true));
  assert.throws(() => assertReducedMotionFallback(false), FieldUIError);
});

test('meaning survives without motion: reduced motion keeps focus, drops travel; emission flattens', () => {
  const u = createUserAgent(true);
  updateUserAgent(u, { pointer: { x: 0, y: 0 } });
  updateUserAgent(u, { pointer: { x: 40, y: 0 }, focusId: 'cta' });
  const src = userFieldSource(u);
  assert.equal(src.wake, null, 'no travel under reduced motion');
  assert.equal(src.focus, 'cta', 'accessible focus source remains');
  assert.ok(emission({ heat: 1 }, { reducedMotion: true }).alpha < emission({ heat: 1 }).alpha);
});

test('color/glyph are not the sole carriers (lint enforces)', () => {
  const f = runVisualLint({ colorOnlyMeaning: true, glyphOnlySemanticText: true, reducedMotionFallback: true });
  const rules = f.map((x) => x.rule);
  assert.ok(rules.includes('color-only-meaning'));
  assert.ok(rules.includes('glyph-only-text'));
});

test('field events are thresholded/debounced (no per-frame spam)', () => {
  const t = new Thresholder({ enter: 0.6, exit: 0.3, debounceMs: 100 });
  // feeding a high value many frames yields exactly one "entered" edge
  let edges = 0;
  for (let i = 0; i < 10; i++) if (t.update(0.9, 200 + i * 16) === 'entered') edges++;
  assert.equal(edges, 1, 'one edge, not one per frame');
  // the named events carry both namespaces and respect thresholds
  assert.equal(FIELD_EVENTS.lit.field, 'field:lit');
  assert.equal(FIELD_EVENTS.lit.metric, 'density');
});

test('the Accessibility Contract is published in the catalog', () => {
  assert.ok(CONTRACTS.some((c) => c.name === 'Accessibility Contract'));
});
