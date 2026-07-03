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
import { setDomDevWarnings, resetDomDevWarnings } from './dev-warn.ts';

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

test('StateRegistry.clearAll + FeedbackRegistry.clearAll drop every entry immediately (teardown)', () => {
  const s = new StateRegistry();
  const fb = new FeedbackRegistry();
  const a = fakeEl();
  const b = fakeEl();
  s.set(a, 'lit', 1);
  s.set(b, 'density', 0.5);
  s.observe(a, 'lit', () => {});
  fb.bind(a, { density: '--field-density' });
  fb.set(b, { '--x': '1' });
  fb.threshold(a, 'field:lit', { metric: 'lit', enter: 0.5, exit: 0.4 });
  assert.ok(s.elements().length === 2);

  s.clearAll();
  assert.equal(s.elements().length, 0, 'state cleared regardless of connection');

  // feedback cleared: even connected bindings/thresholds are gone → no writes on the next flush
  let writes = 0;
  (a as { style: unknown }).style = { setProperty: () => void writes++ };
  fb.clearAll();
  fb.flush(s);
  assert.equal(writes, 0, 'no bindings survive clearAll');
});

test('FeedbackRegistry.prune drops only disconnected elements (leaves live ones)', () => {
  const fb = new FeedbackRegistry();
  const state = new StateRegistry();
  const live = fakeEl();
  const dead = fakeEl();
  fb.bind(live, { density: '--field-density' });
  fb.bind(dead, { density: '--field-density' });
  fb.threshold(dead, 'field:dense', { metric: 'density', enter: 0.5, exit: 0.4 });
  state.set(live, 'density', 0.4);
  dead.isConnected = false;

  fb.prune();
  let liveWrites = 0;
  let deadWrites = 0;
  (live as { style: unknown }).style = { setProperty: () => void liveWrites++ };
  (dead as { style: unknown }).style = { setProperty: () => void deadWrites++ };
  fb.flush(state);
  assert.equal(deadWrites, 0, 'pruned dead binding never writes');
  assert.ok(liveWrites > 0, 'live binding survives prune');
});

test('discover()/scan() dev-warn once if called at frame frequency; silent in production', () => {
  const orig = console.warn;
  const seen: string[] = [];
  console.warn = (m?: unknown) => void seen.push(String(m));
  try {
    setDomDevWarnings(true);
    resetDomDevWarnings();
    seen.length = 0;
    const reg = new RelationshipRegistry();
    const root = { querySelectorAll: () => [] } as unknown as ParentNode;
    // hammer discover well past the frequency threshold (default 20 / window)
    for (let i = 0; i < 60; i++) reg.discover(root, () => null);
    const warns = seen.filter((m) => m.includes('FREQUENT_RELATIONSHIP_DISCOVER'));
    assert.equal(warns.length, 1, 'warns exactly once (deduped) at frame frequency');

    setDomDevWarnings(false);
    resetDomDevWarnings();
    seen.length = 0;
    for (let i = 0; i < 60; i++) reg.discover(root, () => null);
    assert.equal(seen.length, 0, 'silent in production');
  } finally {
    console.warn = orig;
    setDomDevWarnings(true);
    resetDomDevWarnings();
  }
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
