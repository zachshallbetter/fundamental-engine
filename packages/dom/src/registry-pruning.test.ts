/**
 * Lifecycle symmetry for the platform registries (#367): entries for elements that left the DOM
 * are pruned at each registry's natural moment (flush / discover / prune), and every registry
 * offers an explicit unregister for immediate reclamation. Same fake-element pattern as
 * platform.test.ts — `isConnected` is the only DOM fact these paths read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateRegistry } from './state.ts';
import { FeedbackRegistry } from './feedback.ts';
import { RelationshipRegistry } from './relationships.ts';
import { OverlayRegistry } from './overlays.ts';
import { createFieldPlatform } from './platform.ts';

type Fake = Element & { isConnected: boolean; style: { setProperty(k: string, v: string): void } };

function fakeEl(connected = true): Fake {
  const el = new EventTarget() as unknown as Fake;
  el.isConnected = connected;
  (el as { style: unknown }).style = { setProperty: () => {} };
  return el;
}

test('FeedbackRegistry: flush prunes bindings and thresholds for disconnected elements', () => {
  const fb = new FeedbackRegistry();
  const state = new StateRegistry();
  const live = fakeEl();
  const dead = fakeEl();
  fb.bind(live, { density: '--field-density' });
  fb.bind(dead, { density: '--field-density' });
  fb.threshold(dead, 'density', 0.5, 'field:dense');
  state.set(live, 'density', 0.4);
  state.set(dead, 'density', 0.9);

  dead.isConnected = false;
  fb.flush(state);
  // a second flush sees the pruned maps — the dead element costs nothing further
  fb.flush(state);
  // the prune is observable through write counts: a dead element's binding stops costing writes
  let deadWrites = 0;
  (dead as { style: unknown }).style = { setProperty: () => void deadWrites++ };
  fb.flush(state);
  assert.equal(deadWrites, 0, 'pruned binding never writes again');
});

test('FeedbackRegistry: unregister drops one element immediately', () => {
  const fb = new FeedbackRegistry();
  const state = new StateRegistry();
  const el = fakeEl();
  let writes = 0;
  (el as { style: unknown }).style = { setProperty: () => void writes++ };
  fb.bind(el, { density: '--field-density' });
  state.set(el, 'density', 0.7);
  fb.flush(state);
  const before = writes;
  assert.ok(before > 0, 'bound element receives writes');
  fb.unregister(el);
  fb.flush(state);
  assert.equal(writes, before, 'no writes after unregister');
});

test('RelationshipRegistry: discover replaces the unresolved set — late-mounting targets resolve', () => {
  const reg = new RelationshipRegistry();
  const from = fakeEl();
  (from as { getAttribute(n: string): string | null }).getAttribute = (n: string) =>
    n === 'data-field-relation' ? 'supports' : n === 'data-field-target' ? '#claim' : null;
  const root = { querySelectorAll: () => [from] } as unknown as ParentNode;

  reg.discover(root, () => null); // target missing → unresolved
  const unresolvedFirst = reg.unresolvedAll().length;
  assert.ok(unresolvedFirst > 0, 'missing target recorded as unresolved');

  const target = fakeEl();
  reg.discover(root, () => target); // target mounted → resolves; unresolved set was replaced
  assert.equal(reg.unresolvedAll().length, 0, 'late-mounted target left no stale unresolved entry');
  assert.ok(reg.all().length > 0, 'the edge is live now');
});

test('RelationshipRegistry: discover prunes edges whose endpoints left the DOM; unregister is immediate', () => {
  const reg = new RelationshipRegistry();
  const a = fakeEl();
  const b = fakeEl();
  reg.add({ from: a, to: b, type: 'supports', source: 'runtime' } as Parameters<RelationshipRegistry['add']>[0]);
  assert.equal(reg.all().length, 1);

  b.isConnected = false;
  reg.discover({ querySelectorAll: () => [] } as unknown as ParentNode, () => null);
  assert.equal(reg.all().length, 0, 'disconnected endpoint pruned on discover');

  const c = fakeEl();
  const d = fakeEl();
  reg.add({ from: c, to: d, type: 'supports', source: 'runtime' } as Parameters<RelationshipRegistry['add']>[0]);
  reg.unregister(c);
  assert.equal(reg.all().length, 0, 'unregister drops edges touching the element');
});

test('StateRegistry: per-key delete leaves no empty husks; prune() sweeps disconnected elements', () => {
  const s = new StateRegistry();
  const el = fakeEl();
  s.set(el, 'density', 0.5);
  const off = s.observe(el, 'density', () => {});
  off();
  s.delete(el, 'density');
  assert.equal(s.elements().length, 0, 'last key deleted → element fully gone from the store');

  const dead = fakeEl();
  s.set(dead, 'density', 1);
  dead.isConnected = false;
  s.prune();
  assert.equal(s.elements().length, 0, 'prune sweeps disconnected elements');
});

test('OverlayRegistry: prune drops overlays whose source element left the DOM', () => {
  const reg = new OverlayRegistry();
  const a = fakeEl();
  const b = fakeEl();
  reg.add({ type: 'relationship', sourceElements: [a, b] });
  assert.equal(reg.all().length, 1);

  b.isConnected = false;
  reg.prune();
  assert.equal(reg.all().length, 0, 'overlay with a detached endpoint is pruned');
});

test('createFieldPlatform: the write cadence sweeps state + overlays for detached elements', () => {
  const VP = { x: 0, y: 0, width: 1000, height: 1000, scrollX: 0, scrollY: 0 };
  const root = fakeEl() as unknown as Element;
  const platform = createFieldPlatform(root);

  // StateRegistry entries accumulate from the per-frame sink and nothing else prunes them.
  const deadState = fakeEl();
  platform.state.set(deadState, 'lit', 1);
  // An overlay pins both endpoints with strong refs.
  const a = fakeEl();
  const b = fakeEl();
  platform.overlays.add({ type: 'relationship', sourceElements: [a, b] });

  deadState.isConnected = false;
  b.isConnected = false;
  // frame 0 satisfies (frame % 120 === 0) → both prunes fire on the write phase
  platform.tick(0, VP);

  assert.equal(platform.state.elements().length, 0, 'state pruned on the write cadence');
  assert.equal(platform.overlays.all().length, 0, 'overlays pruned on the write cadence');
});
