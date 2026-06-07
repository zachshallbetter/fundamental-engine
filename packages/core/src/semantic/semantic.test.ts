/**
 * Semantic-layer tests (BA2). The maps are data; the test verifies they map to real metrics/forces
 * and the helpers are pure and bounded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEMANTIC_LAYERS, semanticToMetrics } from './layers.ts';
import { INTERACTION_MATERIALS, materialBody } from './materials.ts';
import { FIELD_STATES, isFieldState } from './states.ts';
import { SEMANTIC_CONTRACTS } from './index.ts';
import { passportFor } from '../contracts/passport.ts';

test('semantic layers map meaning to a metric; semanticToMetrics is bounded', () => {
  assert.equal(SEMANTIC_LAYERS.confidence.metric, 'coherence');
  assert.equal(SEMANTIC_LAYERS.urgency.metric, 'heat');
  assert.equal(SEMANTIC_LAYERS.uncertainty.metric, 'entropy');
  assert.deepEqual(semanticToMetrics('urgency', 0.7), { heat: 0.7 });
  assert.deepEqual(semanticToMetrics('urgency', 5), { heat: 1 }, 'clamps');
  assert.deepEqual(semanticToMetrics('status', 0.5), {}, 'phase is conceptual, no ElementMetric');
});

test('every interaction material composes real, passported forces', () => {
  for (const [name, recipe] of Object.entries(INTERACTION_MATERIALS))
    for (const t of recipe.tokens) assert.ok(passportFor(t), `material "${name}" uses real force "${t}"`);
  assert.equal(materialBody('plasma'), 'fieldflow thermal');
});

test('field states each declare a behavior; isFieldState guards', () => {
  for (const s of Object.keys(FIELD_STATES)) assert.ok(FIELD_STATES[s as keyof typeof FIELD_STATES].length > 0);
  assert.equal(isFieldState('loading'), true);
  assert.equal(isFieldState('nope'), false);
  assert.equal(FIELD_STATES.error, 'repel + thermal');
});

test('semantic contracts are published (truth mode: semantic)', () => {
  const names = SEMANTIC_CONTRACTS.map((c) => c.name);
  assert.ok(names.includes('Semantic Layer Contract'));
  assert.ok(names.includes('Interaction Material Contract'));
  assert.ok(names.includes('Field State Contract'));
});
