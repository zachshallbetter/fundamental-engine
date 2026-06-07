/**
 * FieldAgent model tests (Phase 5). The agent dynamics are pure, so each is checked deterministically:
 * the thresholder emits one clean hysteretic/debounced edge per crossing; relationships strengthen
 * and decay; ElementAgent metrics map to both --field-* and --forces-* vars; the UserAgent respects
 * reduced motion; layout aggregates and data salience decays.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Thresholder, eventNamesFor } from './event-agent.ts';
import {
  updateRelationship,
  attentionTransfer,
  type RelationshipAgent,
} from './relationship.ts';
import { elementAgentVars, elementAgentState } from './element-agent.ts';
import { createUserAgent, updateUserAgent, userFieldSource } from './user-agent.ts';
import { aggregateMetric, updateDataAgent, type LayoutAgent, type DataAgent } from './region-agents.ts';
import { AGENT_CONTRACTS } from './index.ts';

test('Thresholder fires one hysteretic, debounced edge per crossing', () => {
  const t = new Thresholder({ enter: 0.6, exit: 0.3, debounceMs: 100 });
  assert.equal(t.update(0.5, 0), null); // below enter
  assert.equal(t.update(0.7, 200), 'entered'); // crosses up
  assert.equal(t.update(0.9, 400), null); // already lit, no repeat
  assert.equal(t.update(0.4, 600), null); // between exit and enter → hysteresis holds
  assert.equal(t.update(0.2, 800), 'exited'); // crosses down
  assert.equal(t.isLit, false);
});

test('Thresholder debounce suppresses a too-soon edge', () => {
  const t = new Thresholder({ enter: 0.6, exit: 0.3, debounceMs: 500 });
  assert.equal(t.update(0.7, 0), 'entered');
  assert.equal(t.update(0.2, 100), null); // within debounce window → suppressed
  assert.equal(t.update(0.2, 700), 'exited'); // after window
});

test('eventNamesFor maps density to lit/dim with both namespaces', () => {
  assert.deepEqual(eventNamesFor('density', 'entered'), { field: 'field:lit', forces: 'forces:lit' });
  assert.deepEqual(eventNamesFor('density', 'exited'), { field: 'field:dim', forces: 'forces:dim' });
  assert.deepEqual(eventNamesFor('attention', 'entered'), { field: 'field:entered', forces: 'forces:entered' });
});

test('relationship strengthens with use and decays when idle, bounded to [0,1]', () => {
  const r: RelationshipAgent = { id: 'r', from: 'a', to: 'b', type: 'cites', strength: 0, tension: 0, memory: 0, active: false };
  for (let i = 0; i < 20; i++) updateRelationship(r, true, 0.1, 0.1);
  assert.ok(r.strength > 0.5, 'strengthened with use');
  assert.ok(r.memory > 0, 'accumulated memory');
  const peak = r.strength;
  for (let i = 0; i < 50; i++) updateRelationship(r, false, 0, 0.1);
  assert.ok(r.strength < peak, 'decayed when idle');
  assert.ok(r.strength >= 0 && r.strength <= 1);
});

test('attentionTransfer scales by strength', () => {
  const r: RelationshipAgent = { id: 'r', from: 'a', to: 'b', type: 'x', strength: 0.5, tension: 0, memory: 0, active: true };
  assert.equal(attentionTransfer(r, 1, 0.4), 0.2); // 1 * 0.5 * 0.4
});

test('ElementAgent maps metrics to both --field-* and --forces-* vars + data bands', () => {
  const vars = elementAgentVars({ density: 0.8, pullX: -0.5 });
  assert.equal(vars['--field-density'], '0.800');
  assert.equal(vars['--forces-density'], '0.800');
  assert.equal(vars['--field-pull-x'], '-0.500');
  assert.equal(vars['--forces-pull-x'], '-0.500');
  const state = elementAgentState({ density: 0.8, heat: 0.1 });
  assert.equal(state['data-field-density'], 'high');
  assert.equal(state['data-field-heat'], 'low');
  assert.equal('data-field-pull-x' in elementAgentState({ pullX: 0.9 }), false); // vectors get no band
});

test('UserAgent reduced motion drops the pointer wake but keeps focus', () => {
  const u = createUserAgent(true); // reduced motion
  updateUserAgent(u, { pointer: { x: 0, y: 0 } });
  updateUserAgent(u, { pointer: { x: 50, y: 0 }, focusId: 'nav' });
  const src = userFieldSource(u);
  assert.equal(src.wake, null, 'no moving wake under reduced motion');
  assert.equal(src.focus, 'nav', 'focus source survives');

  const u2 = createUserAgent(false);
  updateUserAgent(u2, { pointer: { x: 0, y: 0 } });
  updateUserAgent(u2, { pointer: { x: 50, y: 0 } });
  assert.ok(userFieldSource(u2).wake, 'a moving pointer makes a wake when motion is allowed');
});

test('LayoutAgent aggregates contained bodies; DataAgent salience decays', () => {
  const region: LayoutAgent = { id: 'col', rect: { x: 0, y: 0, w: 100, h: 100 }, metrics: {} };
  const mean = aggregateMetric(region, [
    { cx: 10, cy: 10, value: 1 },
    { cx: 50, cy: 50, value: 0 },
    { cx: 999, cy: 999, value: 1 }, // outside
  ]);
  assert.equal(mean, 0.5);
  assert.equal(aggregateMetric(region, []), 0);

  const d: DataAgent = { id: 'rec', fields: { title: 'x' }, salience: 0.5 };
  updateDataAgent(d, true, 0.1);
  assert.ok(d.salience > 0.5);
  updateDataAgent(d, false, 2);
  assert.equal(d.salience, 0, 'decays and clamps to 0');
});

test('every agent type has a contract', () => {
  const names = AGENT_CONTRACTS.map((c) => c.name);
  for (const n of ['ElementAgent', 'RelationshipAgent', 'UserAgent', 'LayoutAgent', 'DataAgent', 'EventAgent'])
    assert.ok(names.some((x) => x.startsWith(n)), `${n} contract present`);
});
