/**
 * First-class body identity (substrate critical path). Verifies:
 *   · every body resolves a stable, structured FieldBodyIdentity (identity.id === the top-level id);
 *   · identity is stable across frames / snapshots (the primary key never drifts);
 *   · supplied identity (addBody({ identity })) and the `identify` field-option resolver take effect;
 *   · snapshot/diff key on identity.id (a body's metrics change is attributed to the same id).
 *
 * Headless — a tick host with no DOM (createField(undefined, { host })), mirroring field-snapshot.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import type { FieldHost } from './engine/host.ts';
import type { FieldOptions } from './engine/types.ts';

function tickHost(width: number, height: number): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: (at) => { t = at ?? t + 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

function makeField(opts: Partial<FieldOptions> = {}) {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none', ...opts });
  return { field, tick };
}

test('identity: every body carries a structured identity with identity.id === id (derived)', () => {
  const { field, tick } = makeField();
  field.addBody({ tokens: ['attract'], strength: 1, range: 200, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
  for (let i = 0; i < 4; i++) tick();
  const res = field.query();
  assert.equal(res.bodies.length, 1);
  const reading = res.bodies[0]!;
  assert.ok(reading.identity, 'reading carries identity');
  assert.equal(reading.identity.id, reading.id, 'identity.id equals the top-level id (back-compat)');
  assert.ok(reading.identity.id.startsWith('body-'), 'a body with no supplied identity derives a synthetic body-N id');
  field.destroy();
});

test('identity: supplied via addBody({ identity }) — structured metadata surfaces on query + snapshot', () => {
  const { field, tick } = makeField();
  field.addBody({
    tokens: ['attract'],
    identity: { id: 'hero', namespace: 'site', kind: 'heading', host: 'three' },
    strength: 1, range: 200, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }),
  });
  for (let i = 0; i < 4; i++) tick();
  const q = field.query().bodies[0]!;
  assert.equal(q.id, 'hero');
  assert.deepEqual(q.identity, { id: 'hero', namespace: 'site', kind: 'heading', host: 'three' });
  const snap = field.snapshot();
  assert.equal(snap.bodies[0]!.id, 'hero');
  assert.equal(snap.bodies[0]!.identity.kind, 'heading');
  field.destroy();
});

test('identity: a bare-string identity is shorthand for { id }', () => {
  const { field, tick } = makeField();
  field.addBody({ tokens: ['attract'], identity: 'tag-1', strength: 1, range: 200, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
  for (let i = 0; i < 4; i++) tick();
  const q = field.query().bodies[0]!;
  assert.deepEqual(q.identity, { id: 'tag-1' });
  field.destroy();
});

test('identity: stable across frames — same id every query even as metrics change', () => {
  const { field, tick } = makeField();
  field.addBody({ tokens: ['attract'], identity: 'A', strength: 1, range: 260, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  for (let i = 0; i < 3; i++) tick();
  const id1 = field.query().bodies[0]!.identity.id;
  for (let i = 0; i < 20; i++) tick();
  const id2 = field.query().bodies[0]!.identity.id;
  assert.equal(id1, 'A');
  assert.equal(id2, 'A', 'identity.id is constant for the body life across many frames');
  field.destroy();
});

test('identity: snapshot/diff key on identity.id — a metric change is attributed to the same body', () => {
  const { field, tick } = makeField();
  field.addBody({ tokens: ['attract'], identity: 'core', strength: 1, range: 260, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  for (let i = 0; i < 3; i++) tick();
  const a = field.snapshot();
  for (let i = 0; i < 30; i++) tick();
  const b = field.snapshot();
  const d = field.diff(a, b);
  // every change reported for this field references the stable identity id (not a synthetic per-snapshot key).
  for (const change of d.bodyChanges) assert.equal(change.id, 'core');
  field.destroy();
});

test('identity: the `identify` field-option resolver derives identity from the element', () => {
  // A tiny DOM-shaped element the addBody synthetic path exposes has no real id; use a resolver that
  // keys off the data-body tokens the synthetic element carries to prove `identify` is consulted.
  const identify: FieldOptions['identify'] = (el) => {
    const tokens = el.getAttribute('data-body') ?? '';
    return { id: `resolved:${tokens}`, namespace: 'lens', kind: 'derived' };
  };
  const { field, tick } = makeField({ identify });
  // no supplied identity → the resolver runs.
  field.addBody({ tokens: ['attract'], strength: 1, range: 200, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
  for (let i = 0; i < 4; i++) tick();
  const q = field.query().bodies[0]!;
  assert.equal(q.identity.id, 'resolved:attract');
  assert.equal(q.identity.namespace, 'lens');
  assert.equal(q.identity.kind, 'derived');
  field.destroy();
});

test('identity: a supplied identity overrides the `identify` resolver', () => {
  const identify: FieldOptions['identify'] = () => ({ id: 'from-resolver' });
  const { field, tick } = makeField({ identify });
  field.addBody({ tokens: ['attract'], identity: 'pinned', strength: 1, range: 200, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
  for (let i = 0; i < 4; i++) tick();
  assert.equal(field.query().bodies[0]!.identity.id, 'pinned');
  field.destroy();
});
