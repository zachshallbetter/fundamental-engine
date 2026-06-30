/**
 * `<field-root>` substrate-API surface (the FieldField / FieldRoot proxies).
 *
 * The element proxies the substrate FieldHandle members one-by-one — `query`, `snapshot`, `diff`,
 * `replay`, and the `projections` registry getter. A codex review once caught `<field-root>` *missing*
 * these proxies entirely, so this suite tests reachability HARD on both sides of the field's start:
 *
 *   1. BEFORE start (element constructed but never connected → `this.field` is undefined): every member
 *      must be reachable and return a sane empty/pure result WITHOUT throwing. `query`/`snapshot` return
 *      empty readings, `diff`/`replay` are pure (real core math, no field needed), and `projections`
 *      returns the NO-OP registry (NULL_PROJECTIONS) whose `list()` is `[]`.
 *   2. AFTER start (a live `field` handle attached — the same no-DOM prototype-stub pattern as
 *      `field-root-surface.test.ts` / `lifecycle.test.ts`): every member must DELEGATE to the live
 *      field and return correctly-shaped data; a projection registered through the element's live
 *      registry shows up in both `el.projections.list()` and `el.query().projections`.
 *
 * No DOM is needed: the element's methods run against the prototype with a stubbed `this` (`field`
 * undefined for "before", a live fake `FieldHandle` for "after"). See `docs/canonical/system-contracts.md`
 * and `packages/core/src/core/types.ts` for the substrate shapes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField, FieldRoot, FIELD_VERSION } from './index.ts';
import type {
  FieldHandle,
  FieldSnapshot,
  FieldQueryResult,
  FieldProjection,
  FieldProjectionInfo,
  ProjectionRegistry,
} from '@fundamental-engine/core';

// ── fixtures ────────────────────────────────────────────────────────────────

/** A minimal valid snapshot — enough for the pure diff/replay paths to chew on. */
function snap(id: string, frame: number, bodies: FieldSnapshot['bodies'] = []): FieldSnapshot {
  return {
    id,
    createdAt: frame,
    frame,
    version: FIELD_VERSION,
    formations: [],
    bodies,
    relationships: [],
    metrics: {},
    projections: [],
  };
}

/** A real-shaped, in-memory projection registry (the element's NULL_PROJECTIONS is the no-op twin). */
function liveRegistry(): ProjectionRegistry {
  const store = new Map<string, FieldProjection>();
  const info = (p: FieldProjection): FieldProjectionInfo => ({
    id: p.id,
    label: p.label,
    channels: p.channels,
    surfaces: p.surfaces,
    reducedMotionEquivalent: p.reducedMotionEquivalent,
    accessibilityEquivalent: p.accessibilityEquivalent,
  });
  return {
    register(p) {
      store.set(p.id, p);
      return () => void store.delete(p.id);
    },
    unregister(id) {
      store.delete(id);
    },
    get: (id) => store.get(id),
    list: () => [...store.values()].map(info),
    apply(id, reading, target) {
      store.get(id)?.apply?.(reading, target);
    },
  };
}

/** A live fake `FieldHandle` that records substrate calls and returns correctly-shaped data, so the
 *  "after start" half can prove the proxies DELEGATE (vs returning the before-start fallbacks). */
function liveField() {
  const calls: string[] = [];
  const projections = liveRegistry();
  const field = {
    query(q?: unknown): FieldQueryResult {
      calls.push('query');
      return {
        query: (q as FieldQueryResult['query']) ?? {},
        frame: 7,
        time: 1.5,
        bodies: [],
        metrics: { density: 0.5 },
        relationships: [],
        influences: [],
        projections: projections.list(),
      };
    },
    snapshot(): FieldSnapshot {
      calls.push('snapshot');
      return { ...snap('snap-7-1', 7), metrics: { density: 0.5 }, projections: projections.list() };
    },
    diff(a: FieldSnapshot, b: FieldSnapshot) {
      calls.push('diff');
      return { from: a.id, to: b.id, bodyChanges: [], relationshipChanges: [], metricChanges: [], formationChanges: [] };
    },
    replay(a: FieldSnapshot, b: FieldSnapshot) {
      calls.push('replay');
      return { from: a.id, to: b.id, steps: [] };
    },
    projections,
  };
  return { calls, projections, field: field as unknown as FieldHandle };
}

/** an element-shaped `this` with the given live field (or none, for the before-start half). */
function elementWith(field?: FieldHandle): FieldField {
  return Object.assign(Object.create(FieldField.prototype) as object, { field }) as FieldField;
}

const A = snap('snap-0-0', 0, [{ id: 'a', tokens: [], metrics: { m: 1 }, dimensions: {} }]);
const B = snap('snap-1-1', 1, [
  { id: 'a', tokens: [], metrics: { m: 2 }, dimensions: {} },
  { id: 'b', tokens: [], metrics: {}, dimensions: {} },
]);

const projSpec: FieldProjection = {
  id: 'confidence-css',
  label: 'Confidence → CSS',
  channels: ['confidence'],
  surfaces: ['css'],
};

// ── 1. BEFORE start: every member reachable + sane (the codex reachability case) ──────────────

test('before start: query() is reachable and returns an empty, well-shaped reading (no throw)', () => {
  const el = elementWith(undefined);
  const r = el.query();
  assert.deepEqual(r.bodies, [], 'no bodies before start');
  assert.deepEqual(r.relationships, []);
  assert.deepEqual(r.influences, []);
  assert.deepEqual(r.projections, [], 'no projections before start');
  assert.equal(r.frame, 0);
  assert.deepEqual(r.metrics, {});
  // the query echoes back (here, the default {} since none was passed)
  assert.deepEqual(r.query, {});
});

test('before start: query(q) echoes the passed query back', () => {
  const el = elementWith(undefined);
  const q = { region: { x: 0, y: 0, w: 10, h: 10 } };
  assert.deepEqual(el.query(q).query, q);
});

test('before start: snapshot() is reachable and returns an empty, versioned FieldSnapshot (no throw)', () => {
  const el = elementWith(undefined);
  const s = el.snapshot();
  assert.equal(s.version, FIELD_VERSION, 'stamped with the running engine version');
  assert.equal(s.frame, 0);
  assert.deepEqual(s.bodies, []);
  assert.deepEqual(s.relationships, []);
  assert.deepEqual(s.formations, []);
  assert.deepEqual(s.projections, []);
  assert.ok(typeof s.id === 'string' && s.id.length > 0, 'has a snapshot id');
});

test('before start: diff(a,b) is PURE — works with no field, computes the real body delta (no throw)', () => {
  const el = elementWith(undefined);
  const d = el.diff(A, B);
  assert.equal(d.from, A.id);
  assert.equal(d.to, B.id);
  const byId = new Map(d.bodyChanges.map((c) => [c.id, c.kind]));
  assert.equal(byId.get('b'), 'added', "body 'b' is new in B");
  assert.equal(byId.get('a'), 'changed', "body 'a' metric m: 1 → 2");
});

test('before start: replay(a,b) is PURE — works with no field, returns a narrated CausalReplay (no throw)', () => {
  const el = elementWith(undefined);
  const rep = el.replay(A, B);
  assert.equal(rep.from, A.id);
  assert.equal(rep.to, B.id);
  assert.ok(Array.isArray(rep.steps), 'steps is an array');
});

test('before start: projections is the NO-OP registry — list() is [], register/unregister/get/apply are safe', () => {
  const el = elementWith(undefined);
  const reg = el.projections;
  assert.deepEqual(reg.list(), [], 'empty no-op registry');
  // every method must be reachable without throwing, and registering on the no-op leaves it empty.
  let unregister!: () => void;
  assert.doesNotThrow(() => {
    unregister = reg.register(projSpec);
  });
  assert.deepEqual(reg.list(), [], 'no-op register does not actually store');
  assert.equal(reg.get('confidence-css'), undefined);
  assert.doesNotThrow(() => unregister());
  assert.doesNotThrow(() => reg.unregister('confidence-css'));
  assert.doesNotThrow(() => reg.apply('confidence-css', { confidence: 1 }, {}));
});

test('before start: every substrate proxy is reachable on FieldRoot too (the recommended tag)', () => {
  const el = Object.assign(Object.create(FieldRoot.prototype) as object, { field: undefined }) as FieldRoot;
  assert.doesNotThrow(() => el.query());
  assert.doesNotThrow(() => el.snapshot());
  assert.doesNotThrow(() => el.diff(A, B));
  assert.doesNotThrow(() => el.replay(A, B));
  assert.doesNotThrow(() => el.projections.list());
  assert.deepEqual(el.projections.list(), []);
});

// ── 2. AFTER start: each member delegates to the live field with correct shapes ─────────────────

test('after start: query() delegates to the live field (not the empty fallback)', () => {
  const { calls, field } = liveField();
  const el = elementWith(field);
  const r = el.query();
  assert.ok(calls.includes('query'), 'delegated to field.query');
  assert.equal(r.frame, 7, 'live frame, not the 0 fallback');
  assert.deepEqual(r.metrics, { density: 0.5 }, 'live metrics flow through');
});

test('after start: snapshot() delegates to the live field (not the empty fallback)', () => {
  const { calls, field } = liveField();
  const el = elementWith(field);
  const s = el.snapshot();
  assert.ok(calls.includes('snapshot'), 'delegated to field.snapshot');
  assert.equal(s.frame, 7, 'live frame, not the 0 fallback');
  assert.equal(s.id, 'snap-7-1');
});

test('after start: diff() delegates to the live field', () => {
  const { calls, field } = liveField();
  const el = elementWith(field);
  const d = el.diff(A, B);
  assert.ok(calls.includes('diff'), 'delegated to field.diff (not the pure fallback)');
  assert.equal(d.from, A.id);
  assert.equal(d.to, B.id);
});

test('after start: replay() delegates to the live field', () => {
  const { calls, field } = liveField();
  const el = elementWith(field);
  const rep = el.replay(A, B);
  assert.ok(calls.includes('replay'), 'delegated to field.replay (not the pure fallback)');
  assert.equal(rep.from, A.id);
});

test('after start: projections getter returns the LIVE registry (not NULL_PROJECTIONS)', () => {
  const { projections, field } = liveField();
  const el = elementWith(field);
  assert.equal(el.projections, projections, 'the element exposes the field’s own registry');
});

test('after start: a projection registered via the element shows up in list() and query().projections', () => {
  const { field } = liveField();
  const el = elementWith(field);
  const unregister = el.projections.register(projSpec);

  // it is now visible through the element's registry...
  const listed = el.projections.list();
  assert.equal(listed.length, 1, 'one projection registered');
  assert.equal(listed[0]!.id, 'confidence-css');
  assert.deepEqual(listed[0]!.channels, ['confidence']);
  assert.deepEqual(listed[0]!.surfaces, ['css']);
  assert.equal(el.projections.get('confidence-css')?.id, 'confidence-css', 'get() returns the full spec');

  // ...and through a live query reading (the field reports its registered projections).
  const reflected = el.query().projections;
  assert.equal(reflected.length, 1, 'query() reflects the registered projection');
  assert.equal(reflected[0]!.id, 'confidence-css');

  // unregistering clears both views.
  unregister();
  assert.deepEqual(el.projections.list(), []);
  assert.deepEqual(el.query().projections, []);
});
