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
import { setContractChecks, resetNoOpWarnings } from '../contracts/guards.ts';

test('semantic layers map meaning to a metric; semanticToMetrics is bounded', () => {
  assert.equal(SEMANTIC_LAYERS.confidence.metric, 'coherence');
  assert.equal(SEMANTIC_LAYERS.urgency.metric, 'heat');
  assert.equal(SEMANTIC_LAYERS.uncertainty.metric, 'entropy');
  assert.deepEqual(semanticToMetrics('urgency', 0.7), { heat: 0.7 });
  assert.deepEqual(semanticToMetrics('urgency', 5), { heat: 1 }, 'clamps');
  assert.deepEqual(semanticToMetrics('status', 0.5), {}, 'phase is conceptual, no ElementMetric');
});

test('semanticToMetrics dev-warns (deduped) when a conceptual layer returns {}, silent in production', () => {
  const orig = console.warn;
  const seen: string[] = [];
  console.warn = (m?: unknown) => void seen.push(String(m));
  try {
    // dev path: warns once even across repeated calls (deduped by message)
    setContractChecks(true);
    resetNoOpWarnings();
    seen.length = 0;
    semanticToMetrics('status', 0.5);
    semanticToMetrics('status', 0.9);
    assert.equal(seen.length, 1, 'warns exactly once (deduped)');
    assert.match(seen[0]!, /NOOP_CONCEPTUAL_LAYER/);
    assert.match(seen[0]!, /'status'/);

    // production path: no warn (checks disabled)
    setContractChecks(false);
    resetNoOpWarnings();
    seen.length = 0;
    semanticToMetrics('status', 0.5);
    assert.equal(seen.length, 0, 'silent in production');
  } finally {
    console.warn = orig;
    setContractChecks(true);
    resetNoOpWarnings();
  }
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
