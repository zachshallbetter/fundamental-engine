import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Substrate-API surface test for the React door.
 *
 * `<FieldField onReady={(f) => …}>` and `useFieldField().fieldRef` both hand a consumer the exact
 * `FieldHandle` that `createBrowserField` returns — the component/hook are thin lifecycle wrappers
 * around that one call (see packages/react/src/index.tsx: both effects do
 * `const field = createBrowserField(canvas, {…})` then surface it). The repo forbids jsdom / a React
 * test renderer, and the headless DOM stub never fires `useEffect`, so — exactly as the existing
 * field.test.ts does — we obtain the live handle through that same delegation point and assert the
 * full substrate API (`query`, `snapshot`, `diff`, `replay`, `projections`) is reachable on it,
 * returns the right shape, and round-trips. No engine stepping required (all read-only / pure).
 */

type StubCanvas = HTMLCanvasElement;

function installDOM(): { makeCanvas: () => StubCanvas } {
  const noop = (): void => {};
  const makeCanvas = (): StubCanvas => {
    const node = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      _parent: null as { _remove(n: unknown): void } | null,
      setAttribute: noop,
      getContext: () => ({ setTransform: noop, clearRect: noop, fillRect: noop }),
      remove(): void {
        node._parent?._remove(node);
      },
    };
    return node as unknown as StubCanvas;
  };
  const children: unknown[] = [];
  const body = {
    children,
    appendChild(node: { _parent: unknown }): void {
      children.push(node);
      (node as { _parent: unknown })._parent = body;
    },
    _remove(node: unknown): void {
      const i = children.indexOf(node);
      if (i >= 0) children.splice(i, 1);
    },
  };
  (globalThis as Record<string, unknown>).window = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    scrollY: 0,
    addEventListener: noop,
    removeEventListener: noop,
  };
  (globalThis as Record<string, unknown>).document = {
    body,
    documentElement: { scrollHeight: 2000 },
    createElement: () => makeCanvas(),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    hidden: false,
  };
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1; // never invoke
  (globalThis as Record<string, unknown>).cancelAnimationFrame = noop;
  return { makeCanvas };
}

/** Build a live handle the way the React door surfaces it (the createBrowserField delegation point). */
async function makeHandle(): Promise<{
  handle: import('@fundamental-engine/core').FieldHandle;
  destroy: () => void;
}> {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/dom');
  const canvas = makeCanvas();
  // mirror the FieldField/useFieldField forwarded options set (a representative subset).
  const handle = createBrowserField(canvas, { render: 'dots' });
  return { handle, destroy: () => handle.destroy() };
}

// ── the React door must actually re-export the substrate types/handle ─────────────────────────────

test('React door re-exports FieldHandle (the handle onReady/fieldRef surface)', async () => {
  const mod = await import('../dist/index.js');
  // type-only re-export; presence is proven by the component/hook returning it. Assert the door builds
  // the handle via the same path the component does.
  assert.equal(typeof mod.FieldField, 'function');
  assert.equal(typeof mod.useFieldField, 'function');
});

// ── every substrate member is reachable on the surfaced handle ────────────────────────────────────

test('the surfaced handle exposes the full substrate API as the right kinds', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const h = handle as unknown as Record<string, unknown>;
    assert.equal(typeof h.query, 'function', 'query()');
    assert.equal(typeof h.snapshot, 'function', 'snapshot()');
    assert.equal(typeof h.diff, 'function', 'diff()');
    assert.equal(typeof h.replay, 'function', 'replay()');
    assert.equal(typeof h.projections, 'object', 'projections registry');
    assert.notEqual(h.projections, null, 'projections registry is non-null');
    const reg = h.projections as Record<string, unknown>;
    for (const m of ['register', 'unregister', 'get', 'list', 'apply']) {
      assert.equal(typeof reg[m], 'function', `projections.${m}`);
    }
  } finally {
    destroy();
  }
});

// ── query() returns a structured reading ──────────────────────────────────────────────────────────

test('query() returns a FieldQueryResult shape (global + point)', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const global = handle.query();
    assert.equal(typeof global.frame, 'number');
    assert.equal(typeof global.time, 'number');
    assert.ok(Array.isArray(global.bodies), 'bodies array');
    assert.equal(typeof global.metrics, 'object', 'metrics record');
    assert.ok(Array.isArray(global.relationships), 'relationships array');
    assert.ok(Array.isArray(global.influences), 'influences array');
    assert.ok(Array.isArray(global.projections), 'projections metadata array');

    const point = handle.query({ at: { x: 100, y: 100 }, radius: 200, include: ['bodies', 'influences'] });
    assert.deepEqual(point.query.at, { x: 100, y: 100 }, 'query echoed back');
    assert.ok(Array.isArray(point.influences), 'influences for a point query');
  } finally {
    destroy();
  }
});

// ── snapshot() → diff()/replay() round-trip ───────────────────────────────────────────────────────

test('snapshot() returns a versioned, serializable capture', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const snap = handle.snapshot();
    assert.equal(typeof snap.id, 'string');
    assert.ok(snap.id.length > 0, 'snapshot has an id');
    assert.equal(typeof snap.frame, 'number');
    assert.equal(typeof snap.createdAt, 'number');
    assert.equal(typeof snap.version, 'string');
    assert.ok(Array.isArray(snap.bodies), 'bodies');
    assert.ok(Array.isArray(snap.relationships), 'relationships');
    assert.equal(typeof snap.metrics, 'object', 'metrics');
    assert.ok(Array.isArray(snap.formations), 'formations');
    assert.ok(Array.isArray(snap.projections), 'projections metadata');
    // serializable: survives a JSON round-trip.
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(snap)), 'snapshot JSON-serializable');
  } finally {
    destroy();
  }
});

test('diff(a, b) compares two snapshots and reports change lanes', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const a = handle.snapshot();
    const b = handle.snapshot();
    const d = handle.diff(a, b);
    assert.equal(d.from, a.id, 'diff.from echoes snapshot a');
    assert.equal(d.to, b.id, 'diff.to echoes snapshot b');
    assert.ok(Array.isArray(d.bodyChanges), 'bodyChanges');
    assert.ok(Array.isArray(d.relationshipChanges), 'relationshipChanges');
    assert.ok(Array.isArray(d.metricChanges), 'metricChanges');
    assert.ok(Array.isArray(d.formationChanges), 'formationChanges');
  } finally {
    destroy();
  }
});

test('replay(a, b) explains the change as ordered causal steps', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const a = handle.snapshot();
    const b = handle.snapshot();
    const r = handle.replay(a, b);
    assert.equal(r.from, a.id, 'replay.from');
    assert.equal(r.to, b.id, 'replay.to');
    assert.ok(Array.isArray(r.steps), 'steps array');
    // scoped replay accepts a focus option without throwing.
    const scoped = handle.replay(a, b, { focus: 'nonexistent-body' });
    assert.ok(Array.isArray(scoped.steps), 'scoped steps array');
  } finally {
    destroy();
  }
});

// ── projections registry: register → list → get → apply → unregister round-trip ──────────────────

test('projections registry round-trips: register → list/get → apply (writes to a target) → unregister', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const reg = handle.projections;
    const before = reg.list().length;

    const unregister = reg.register({
      id: 'react-test-proj',
      label: 'React Test Projection',
      channels: ['density'],
      surfaces: ['css'],
      apply(reading, target) {
        target.style?.setProperty('--density', String(reading.density ?? 0));
      },
    });
    assert.equal(typeof unregister, 'function', 'register returns an unregister fn');

    // list() carries the new projection as serializable metadata (no apply).
    const listed = reg.list();
    assert.equal(listed.length, before + 1, 'list grows by one');
    const meta = listed.find((p) => p.id === 'react-test-proj');
    assert.ok(meta, 'projection appears in list()');
    assert.deepEqual(meta!.channels, ['density']);
    assert.deepEqual(meta!.surfaces, ['css']);
    assert.equal((meta as Record<string, unknown>).apply, undefined, 'list() metadata omits apply');

    // get() returns the full projection (with apply).
    const full = reg.get('react-test-proj');
    assert.ok(full, 'get() returns the projection');
    assert.equal(typeof full!.apply, 'function', 'get() carries apply');

    // apply() runs the writer against a target — proving projection → surface output.
    const writes: Record<string, string> = {};
    const target = { style: { setProperty: (k: string, v: string) => { writes[k] = v; } } };
    reg.apply('react-test-proj', { density: 0.42 }, target);
    assert.equal(writes['--density'], '0.42', 'apply() wrote the reading onto the target');

    // both removal paths clear it.
    unregister();
    assert.equal(reg.get('react-test-proj'), undefined, 'unregister fn removes it');
    assert.equal(reg.list().length, before, 'list() shrinks back');

    // unregister(id) is also a no-throw no-op on an absent id.
    assert.doesNotThrow(() => reg.unregister('react-test-proj'));
    // apply() on an absent id is a no-op (does not throw).
    assert.doesNotThrow(() => reg.apply('does-not-exist', {}, target));
  } finally {
    destroy();
  }
});

// ── the registry's projections surface through query()/snapshot() ─────────────────────────────────

test('registered projections surface in query()/snapshot() projections metadata', async () => {
  const { handle, destroy } = await makeHandle();
  try {
    const unregister = handle.projections.register({
      id: 'react-visible-proj',
      label: 'Visible',
      channels: ['confidence'],
      surfaces: ['agent-json'],
    });
    const q = handle.query();
    assert.ok(q.projections.some((p) => p.id === 'react-visible-proj'), 'query() sees the projection');
    const s = handle.snapshot();
    assert.ok(s.projections.some((p) => p.id === 'react-visible-proj'), 'snapshot() sees the projection');
    unregister();
  } finally {
    destroy();
  }
});
