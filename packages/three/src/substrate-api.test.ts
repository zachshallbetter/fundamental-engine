/**
 * Substrate API conformance for the Three.js door. `FieldLayer implements FieldHandle`, so the new
 * substrate surface — `query`, `snapshot`, `diff`, `replay`, and the `projections` registry — must be
 * reachable on the layer and delegate faithfully to the wrapped engine. These tests construct a real
 * `FieldLayer` headlessly (`render: 'none'` on a `threeHost`; `three` is a real dep) and exercise
 * EVERY substrate member: reachability + correct shape + round-trip (snapshot→diff/replay;
 * projections.register→list→apply writes to a target). They assert on structure/delegation, never on
 * the engine stepping (rAF may not fire under `node --test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal browser globals — the `threeHost` reaches `window`/`document`/rAF to wire resize,
// input, visibility and a stub canvas, exactly as it would inside a real Three.js app. `node --test`
// has none of these, so we provide the thinnest shims that satisfy the host. The engine runs with
// `render: 'none'` (no 2D context is acquired), and we never rely on rAF firing — these only let the
// host install/remove its (no-op-in-test) listeners. Set before importing the layer.
const noop = (): void => {};
const fakeEventTarget = { addEventListener: noop, removeEventListener: noop };
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= { ...fakeEventTarget };
g.document ??= {
  ...fakeEventTarget,
  hidden: false,
  createElement: () => ({ getContext: () => null, style: {}, setAttribute: noop }),
};
g.requestAnimationFrame ??= (() => 0) as typeof requestAnimationFrame;
g.cancelAnimationFrame ??= noop as typeof cancelAnimationFrame;
g.devicePixelRatio ??= 1;

import { createFieldLayer, FieldLayer } from './layer.ts';
import { PlaneProjection } from './project.ts';
import type { FieldProjection, FieldProjectionTarget, FieldSnapshot } from '@fundamental-engine/core';
import { Object3D } from 'three';

/** A layer with a couple of bodies registered, so query/snapshot have something to report. */
function makeLayer(): FieldLayer {
  const layer = createFieldLayer({
    projection: new PlaneProjection({ width: 1000, height: 600, scale: 0.01 }),
    count: 32,
  });
  // two mesh-bodies so the substrate surface has real structure to describe
  layer.addBody(new Object3D(), { tokens: ['attract', 'swirl'], strength: 1.4, range: 380, sizePx: 40 });
  const m2 = new Object3D();
  m2.position.set(2, 0, 0);
  layer.addBody(m2, { tokens: 'gravity', strength: 1, range: 300, sizePx: 30 });
  layer.scan();
  return layer;
}

test('FieldLayer constructs headlessly and implements the substrate surface', () => {
  const layer = makeLayer();
  try {
    assert.ok(layer instanceof FieldLayer);
    for (const m of ['query', 'snapshot', 'diff', 'replay'] as const) {
      assert.equal(typeof layer[m], 'function', `layer.${m} is a method`);
    }
    assert.ok(layer.projections, 'layer.projections registry is present');
    for (const m of ['register', 'unregister', 'get', 'list', 'apply'] as const) {
      assert.equal(typeof layer.projections[m], 'function', `projections.${m} is a method`);
    }
  } finally {
    layer.destroy();
  }
});

test('query() returns a well-shaped, read-only FieldQueryResult', () => {
  const layer = makeLayer();
  try {
    const r = layer.query();
    assert.ok(r && typeof r === 'object', 'a result object');
    assert.ok(r.query && typeof r.query === 'object', 'echoes the query');
    assert.equal(typeof r.frame, 'number', 'frame');
    assert.equal(typeof r.time, 'number', 'time');
    assert.ok(Array.isArray(r.bodies), 'bodies array');
    assert.ok(r.metrics && typeof r.metrics === 'object', 'metrics record');
    assert.ok(Array.isArray(r.relationships), 'relationships array');
    assert.ok(Array.isArray(r.influences), 'influences array');
    assert.ok(Array.isArray(r.projections), 'projections array');
    assert.ok(r.bodies.length >= 2, 'the two registered bodies are reported');
    for (const b of r.bodies) {
      assert.equal(typeof b.id, 'string', 'body id');
      assert.ok(Array.isArray(b.tokens), 'body tokens');
      assert.ok(b.metrics && typeof b.metrics === 'object', 'body metrics');
      assert.ok(b.dimensions && typeof b.dimensions === 'object', 'body dimensions');
    }

    // a point query exercises the influences/region branch and the radius option
    const pt = layer.query({ at: { x: 500, y: 300 }, radius: 300, include: ['bodies', 'influences'] });
    assert.ok(pt.region && typeof pt.region === 'object', 'point query resolves a region');
    assert.ok(Array.isArray(pt.influences), 'point query carries influences');
  } finally {
    layer.destroy();
  }
});

test('snapshot() returns a portable, serializable FieldSnapshot delegated from the engine', () => {
  const layer = makeLayer();
  try {
    const snap = layer.snapshot();
    assert.equal(typeof snap.id, 'string', 'snapshot id');
    assert.equal(typeof snap.createdAt, 'number', 'createdAt');
    assert.equal(typeof snap.frame, 'number', 'frame');
    assert.equal(snap.version, layer.version, 'snapshot version matches the engine version (delegation)');
    assert.ok(Array.isArray(snap.formations), 'formations');
    assert.ok(Array.isArray(snap.bodies), 'bodies');
    assert.ok(Array.isArray(snap.relationships), 'relationships');
    assert.ok(snap.metrics && typeof snap.metrics === 'object', 'metrics');
    assert.ok(Array.isArray(snap.projections), 'projections metadata');
    assert.equal(snap.particles, undefined, 'particles omitted by default');
    assert.ok(snap.bodies.length >= 2, 'snapshot captures the registered bodies');

    // round-trips through JSON (the contract: plain data, safe to serialize)
    const round = JSON.parse(JSON.stringify(snap)) as FieldSnapshot;
    assert.equal(round.id, snap.id, 'survives JSON round-trip');

    // includeParticles option flows through to the engine
    const withP = layer.snapshot({ includeParticles: true });
    assert.ok(Array.isArray(withP.particles), 'includeParticles populates the particle pool');
  } finally {
    layer.destroy();
  }
});

test('diff() compares two snapshots and returns a structured FieldDiff', () => {
  const layer = makeLayer();
  try {
    const a = layer.snapshot();
    // mutate the field's structure between snapshots so the diff has something to report
    const m = new Object3D();
    m.position.set(-2, 1, 0);
    layer.addBody(m, { tokens: 'charge', strength: 0.8, range: 260, sizePx: 24 });
    layer.scan();
    const b = layer.snapshot();

    const d = layer.diff(a, b);
    assert.equal(d.from, a.id, 'diff.from is the first snapshot id');
    assert.equal(d.to, b.id, 'diff.to is the second snapshot id');
    assert.ok(Array.isArray(d.bodyChanges), 'bodyChanges');
    assert.ok(Array.isArray(d.relationshipChanges), 'relationshipChanges');
    assert.ok(Array.isArray(d.metricChanges), 'metricChanges');
    assert.ok(Array.isArray(d.formationChanges), 'formationChanges');
    assert.ok(
      d.bodyChanges.some((c) => c.kind === 'added'),
      'the newly added body shows as an "added" body change',
    );
  } finally {
    layer.destroy();
  }
});

test('replay() explains how the field changed between two snapshots', () => {
  const layer = makeLayer();
  try {
    const a = layer.snapshot();
    const m = new Object3D();
    m.position.set(1, -1, 0);
    layer.addBody(m, { tokens: 'sink', strength: 1.2, range: 280, sizePx: 28 });
    layer.scan();
    const b = layer.snapshot();

    const replay = layer.replay(a, b);
    assert.equal(replay.from, a.id, 'replay.from');
    assert.equal(replay.to, b.id, 'replay.to');
    assert.ok(Array.isArray(replay.steps), 'steps array');
    for (const s of replay.steps) {
      assert.equal(typeof s.frame, 'number', 'step.frame');
      assert.equal(typeof s.time, 'number', 'step.time');
      assert.equal(typeof s.cause, 'string', 'step.cause');
      assert.equal(typeof s.description, 'string', 'step.description');
    }

    // the focus option flows through (delegation): scope to a known body id
    const ids = b.bodies.map((bd) => bd.id);
    const scoped = layer.replay(a, b, { focus: ids[0] });
    assert.equal(scoped.focus, ids[0], 'replay honours the focus option');
  } finally {
    layer.destroy();
  }
});

test('projections registry: register → list → get → apply writes to a target → unregister', () => {
  const layer = makeLayer();
  try {
    let captured: { reading: Record<string, number>; target: FieldProjectionTarget } | null = null;
    const proj: FieldProjection = {
      id: 'three-test-glow',
      label: 'Three Test Glow',
      channels: ['density', 'load'],
      surfaces: ['css'],
      reducedMotionEquivalent: 'a static border',
      apply(reading, target) {
        captured = { reading, target };
        target.style?.setProperty('--glow', String(reading.density ?? 0));
        target.setAttribute?.('data-glow', String(reading.load ?? 0));
      },
    };

    // register returns an unregister fn
    const unregister = layer.projections.register(proj);
    assert.equal(typeof unregister, 'function', 'register returns an unregister fn');

    // list() surfaces serializable metadata (no apply)
    const listed = layer.projections.list();
    const meta = listed.find((p) => p.id === 'three-test-glow');
    assert.ok(meta, 'the projection appears in list()');
    assert.equal(meta!.label, 'Three Test Glow');
    assert.deepEqual(meta!.channels, ['density', 'load']);
    assert.deepEqual(meta!.surfaces, ['css']);
    assert.equal(meta!.reducedMotionEquivalent, 'a static border');
    assert.equal((meta as unknown as { apply?: unknown }).apply, undefined, 'list() metadata omits apply');

    // it also shows up in a query()'s projections section (substrate read path)
    assert.ok(
      layer.query().projections.some((p) => p.id === 'three-test-glow'),
      'a registered projection is visible to query()',
    );

    // get() returns the full projection (incl. apply)
    const full = layer.projections.get('three-test-glow');
    assert.ok(full, 'get() returns the projection');
    assert.equal(typeof full!.apply, 'function', 'get() includes apply');

    // apply() writes the reading onto a caller-owned target — the round-trip the surface promises
    const writes: Record<string, string> = {};
    const target: FieldProjectionTarget = {
      style: { setProperty: (k, v) => void (writes[k] = v) },
      setAttribute: (k, v) => void (writes[k] = v),
    };
    layer.projections.apply('three-test-glow', { density: 0.62, load: 0.3 }, target);
    assert.ok(captured, 'apply invoked the projection writer');
    assert.equal(captured!.reading.density, 0.62, 'reading passed through verbatim');
    assert.equal(writes['--glow'], '0.62', 'writer set the CSS var on the target');
    assert.equal(writes['data-glow'], '0.3', 'writer set the attribute on the target');

    // applying an unknown id is a safe no-op (no throw)
    assert.doesNotThrow(() => layer.projections.apply('nope', {}, target), 'unknown id is a no-op');

    // unregister via id, then via the returned fn — both remove it from list()
    layer.projections.unregister('three-test-glow');
    assert.ok(!layer.projections.list().some((p) => p.id === 'three-test-glow'), 'unregister(id) removed it');
    assert.equal(layer.projections.get('three-test-glow'), undefined, 'get() is undefined after unregister');
    assert.doesNotThrow(() => unregister(), 'the returned unregister fn is idempotent/safe after manual unregister');
  } finally {
    layer.destroy();
  }
});

test('the substrate surface is the SAME registry/result the wrapped engine exposes (delegation, not a copy)', () => {
  const layer = makeLayer();
  try {
    // registering through layer.projections must be observable through layer.projections again
    // (a fresh getter each access would still reflect the engine's single registry).
    const off = layer.projections.register({ id: 'd1', label: 'D1', channels: ['x'], surfaces: ['agent-json'] });
    assert.ok(layer.projections.list().some((p) => p.id === 'd1'), 'registry state persists across getter accesses');
    off();
    assert.ok(!layer.projections.list().some((p) => p.id === 'd1'), 'and the unregister is observed too');
  } finally {
    layer.destroy();
  }
});
