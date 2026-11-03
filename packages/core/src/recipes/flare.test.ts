/**
 * Completion Flare — conformance for the flare pattern (#567). Same bar as the rest of the
 * experimental set: real tokens, known layers, primitives = body tokens, reduced-motion
 * equivalents, compiles, round-trips, stays OUT of the canonical 64.
 *
 * Plus the one that is specific to this pattern: it must not quietly become a `burst`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePattern, serializePattern, parseRecipe, primitivesOf, FIELD_MODES } from './schema.ts';
import { COMPLETION_FLARE, FLARE_PATTERNS } from './flare.ts';
import { EXPERIMENTAL_PATTERNS } from './wayfinding.ts';
import { FIELD_RECIPES, patternById } from './catalog.ts';
import { compileRecipe } from './compile.ts';
import { passportFor } from '../contracts/passport.ts';

test('completion-flare validates: real tokens, known layers, primitives match body tokens', () => {
  const problems = validatePattern(COMPLETION_FLARE);
  assert.deepEqual(problems, [], problems.map((p) => `${p.path} ${p.issue}`).join(', '));
  assert.deepEqual(COMPLETION_FLARE.primitives, primitivesOf(COMPLETION_FLARE.bodies));
  for (const p of COMPLETION_FLARE.primitives) {
    assert.ok(passportFor(p), `primitive "${p}" is a real runtime token`);
    assert.ok(!FIELD_MODES.has(p), `primitive "${p}" is not a render/diagnostic mode`);
  }
});

test('registered experimentally: in EXPERIMENTAL_PATTERNS, resolvable by id, outside the 64', () => {
  assert.ok(EXPERIMENTAL_PATTERNS.some((r) => r.id === 'completion-flare'));
  assert.equal(patternById('completion-flare'), COMPLETION_FLARE);
  assert.ok(!FIELD_RECIPES.includes(COMPLETION_FLARE), 'the canonical 64 is undisturbed');
  assert.equal(FLARE_PATTERNS.length, 1);
});

test('compiles to one gated body and round-trips', () => {
  const plan = compileRecipe(COMPLETION_FLARE);
  assert.equal(plan.bodies.length, 1, 'one body — the flare is not a second emitter');
  assert.deepEqual(parseRecipe(serializePattern(COMPLETION_FLARE)), COMPLETION_FLARE);
});

test('the flare is a channel, not a blast: the pattern declares no matter-moving one-shot', () => {
  // `burst` is not a force token, so it could never be a primitive — the guard that matters is the
  // PROSE, because "flare the thing" is exactly the intent a reader satisfies with burst(x, y).
  // The notes must say not to, since the compiler cannot.
  assert.ok(!COMPLETION_FLARE.primitives.includes('burst' as never));
  assert.match(COMPLETION_FLARE.notes ?? '', /burst/, 'the notes address burst explicitly');
  assert.match(COMPLETION_FLARE.notes ?? '', /pulse\(/, 'and name the call that replaces it');
});

test('the pulse channel is declared as a metric, so the pattern reports what it publishes', () => {
  assert.ok(COMPLETION_FLARE.metrics.includes('pulse'), 'pulse is declared');
  assert.ok(COMPLETION_FLARE.metrics.includes('density'), 'and the standing channel alongside it');
  // the reduced-motion equivalent must be about the VALUE, not about suppressing it — a flare that
  // is simply withheld under reduced motion silently drops the acknowledgement.
  assert.match(COMPLETION_FLARE.accessibility.reducedMotion, /value|wall time/i);
});
