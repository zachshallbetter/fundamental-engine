/**
 * Visualization truth-table tests (BA3 — system-contracts §18 "every render mode needs a truth-table
 * entry"). The table, render-mode catalog, and presets are data; the test checks completeness and
 * the core invariant (only the matter/feedback layers may touch state).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUALIZATION_TRUTH_TABLE,
  RENDER_MODES,
  VISUALIZATION_PRESETS,
} from './visualization.ts';

test('truth table covers the documented visualizations and marks physics mutation honestly', () => {
  const names = VISUALIZATION_TRUTH_TABLE.map((r) => r.visualization);
  for (const v of ['field-lines', 'force-vectors', 'trails', 'heatmap', 'energy', 'topology', 'causality', 'prediction'])
    assert.ok(names.includes(v), `${v} has a truth-table entry`);
  // structure/diagnostic layers must not mutate physics
  const fieldLines = VISUALIZATION_TRUTH_TABLE.find((r) => r.visualization === 'field-lines')!;
  assert.equal(fieldLines.mutatesPhysics, false);
  assert.equal(fieldLines.readsFrom, 'field()');
  // only particles + dom-state are allowed to "mutate" (matter is state; dom-state is visual)
  const mutators = VISUALIZATION_TRUTH_TABLE.filter((r) => r.mutatesPhysics === true || r.mutatesPhysics === 'visual');
  assert.deepEqual(mutators.map((r) => r.visualization).sort(), ['dom-state', 'particles']);
});

test('every render mode declares a shipped/planned status', () => {
  for (const m of RENDER_MODES) assert.ok(m.status === 'shipped' || m.status === 'planned');
  // the core modes are shipped
  const shipped = RENDER_MODES.filter((m) => m.status === 'shipped').map((m) => m.mode);
  for (const m of ['dots', 'trails', 'field-lines', 'streamlines', 'heatmap', 'metaballs', 'voronoi'])
    assert.ok(shipped.includes(m), `${m} is shipped`);
});

test('visualization presets reference known render layers', () => {
  const layers = new Set(['particles', 'dots', 'trails', 'links', 'streamlines', 'metaballs', 'voronoi', 'field-lines', 'heatmap']);
  for (const [name, stack] of Object.entries(VISUALIZATION_PRESETS))
    for (const l of stack) assert.ok(layers.has(l), `preset ${name} layer ${l} is known`);
  assert.deepEqual(VISUALIZATION_PRESETS.reduced, ['field-lines'], 'reduced is static structure');
});
