import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField } from './index.ts';

/**
 * Aggressive delegation test for the SUBSTRATE API on the vanilla surface.
 *
 * The `FieldField` class implements `FieldHandle`; this file proves that every substrate
 * member — `query`, `snapshot`, `diff`, `replay`, the `projections` registry, and the
 * body-`authority` plumbing — is reachable through the class, returns the right SHAPE, and
 * round-trips. It mirrors the DOM-stub harness from `field.test.ts`: the repo forbids jsdom
 * or a test framework, so we hand-roll the few globals `createField` touches. The fake
 * `requestAnimationFrame` never fires, so nothing here depends on simulated motion — we
 * assert on structure and delegation only, which is exactly what survives a never-stepping
 * field.
 */

function installDOM(): void {
  const noop = (): void => {};
  const makeCanvas = (): unknown => {
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
    return node;
  };
  const children: unknown[] = [];
  const body = {
    children,
    appendChild(node: { _parent: unknown }): void {
      children.push(node);
      node._parent = body;
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
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1; // never invoke the frame
  (globalThis as Record<string, unknown>).cancelAnimationFrame = noop;
}

/** A signals-only field with a couple of programmatic bodies — the substrate-test fixture. */
function makeFixture(): FieldField {
  installDOM();
  const field = new FieldField({ render: 'none' });
  field.addBody({
    tokens: ['attract'],
    authority: 'dynamic',
    rect: () => ({ left: 100, top: 100, width: 40, height: 40 }),
  });
  field.addBody({
    tokens: ['gravity', 'swirl'],
    rect: () => ({ left: 300, top: 200, width: 60, height: 60 }),
  });
  return field;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// ── substrate members are reachable through the class ─────────────────────────

test('every substrate member is present on a FieldField instance', () => {
  const field = makeFixture();
  assert.equal(typeof field.query, 'function', 'query');
  assert.equal(typeof field.snapshot, 'function', 'snapshot');
  assert.equal(typeof field.diff, 'function', 'diff');
  assert.equal(typeof field.replay, 'function', 'replay');
  assert.ok(isObj(field.projections), 'projections is an object');
  const reg = field.projections;
  for (const m of ['register', 'unregister', 'get', 'list', 'apply'] as const) {
    assert.equal(typeof reg[m], 'function', `projections.${m}`);
  }
  field.destroy();
});

// ── query() shape ────────────────────────────────────────────────────────────

test('query() returns the full FieldQueryResult shape', () => {
  const field = makeFixture();
  const r = field.query();
  assert.equal(typeof r.frame, 'number', 'frame');
  assert.equal(typeof r.time, 'number', 'time');
  assert.ok(Array.isArray(r.bodies), 'bodies');
  assert.ok(isObj(r.metrics), 'metrics');
  assert.ok(Array.isArray(r.relationships), 'relationships');
  assert.ok(Array.isArray(r.influences), 'influences');
  assert.ok(Array.isArray(r.projections), 'projections');
  field.destroy();
});

test('query() reports a body and its authority in the reading', () => {
  const field = makeFixture();
  const r = field.query();
  assert.ok(r.bodies.length >= 2, `expected ≥2 bodies, got ${r.bodies.length}`);
  for (const b of r.bodies) {
    assert.equal(typeof b.id, 'string', 'body id');
    assert.ok(Array.isArray(b.tokens), 'body tokens');
    assert.ok(isObj(b.metrics), 'body metrics');
    assert.ok(isObj(b.dimensions), 'body dimensions');
  }
  // the dynamic-authority body we added must report its authority
  const authorities = r.bodies.map((b) => b.authority);
  assert.ok(authorities.includes('dynamic'), `expected a 'dynamic' body authority, saw ${JSON.stringify(authorities)}`);
  field.destroy();
});

test('query() accepts a point query with a radius (delegation honours args)', () => {
  const field = makeFixture();
  const r = field.query({ at: { x: 120, y: 120 }, radius: 200, include: ['bodies', 'influences'] });
  assert.ok(isObj(r), 'returns a result');
  assert.ok(Array.isArray(r.bodies), 'bodies present');
  // a point/region query resolves a region
  assert.ok(r.region === undefined || isObj(r.region), 'region is a rect or undefined');
  field.destroy();
});

// ── snapshot() shape ─────────────────────────────────────────────────────────

test('snapshot() returns the full FieldSnapshot shape', () => {
  const field = makeFixture();
  const s = field.snapshot();
  assert.equal(typeof s.id, 'string', 'id');
  assert.equal(typeof s.createdAt, 'number', 'createdAt');
  assert.equal(typeof s.frame, 'number', 'frame');
  assert.equal(typeof s.version, 'string', 'version');
  assert.ok(Array.isArray(s.formations), 'formations');
  assert.ok(Array.isArray(s.bodies), 'bodies');
  assert.ok(Array.isArray(s.relationships), 'relationships');
  assert.ok(isObj(s.metrics), 'metrics');
  assert.ok(Array.isArray(s.projections), 'projections');
  field.destroy();
});

test("snapshot()'s version matches the live handle version", () => {
  const field = makeFixture();
  const s = field.snapshot();
  assert.equal(s.version, field.version, 'snapshot version == FIELD_VERSION');
  field.destroy();
});

test('snapshot() carries body authority through the capture', () => {
  const field = makeFixture();
  const s = field.snapshot();
  assert.ok(s.bodies.length >= 2, 'captured both bodies');
  const authorities = s.bodies.map((b) => b.authority);
  assert.ok(authorities.includes('dynamic'), `dynamic authority captured, saw ${JSON.stringify(authorities)}`);
  field.destroy();
});

test('snapshot({ includeParticles }) attaches a particle array', () => {
  const field = makeFixture();
  const bare = field.snapshot();
  assert.equal(bare.particles, undefined, 'particles omitted by default');
  const withParticles = field.snapshot({ includeParticles: true });
  assert.ok(Array.isArray(withParticles.particles), 'particles array present when asked');
  field.destroy();
});

// ── diff() round-trip ────────────────────────────────────────────────────────

test('diff(a, b) round-trips two snapshots into the FieldDiff shape', () => {
  const field = makeFixture();
  const a = field.snapshot();
  const b = field.snapshot();
  const d = field.diff(a, b);
  assert.equal(d.from, a.id, 'diff.from is snapshot a.id');
  assert.equal(d.to, b.id, 'diff.to is snapshot b.id');
  assert.ok(Array.isArray(d.bodyChanges), 'bodyChanges');
  assert.ok(Array.isArray(d.relationshipChanges), 'relationshipChanges');
  assert.ok(Array.isArray(d.metricChanges), 'metricChanges');
  assert.ok(Array.isArray(d.formationChanges), 'formationChanges');
  field.destroy();
});

test('diff() of a snapshot against itself reports no body churn', () => {
  const field = makeFixture();
  const a = field.snapshot();
  const d = field.diff(a, a);
  // identical snapshots: nothing added or removed (a never-stepping field also won't drift metrics)
  for (const c of d.bodyChanges) {
    assert.notEqual(c.kind, 'added', 'no spurious adds');
    assert.notEqual(c.kind, 'removed', 'no spurious removes');
  }
  field.destroy();
});

// ── replay() round-trip ──────────────────────────────────────────────────────

test('replay(a, b) round-trips two snapshots into the CausalReplay shape', () => {
  const field = makeFixture();
  const a = field.snapshot();
  const b = field.snapshot();
  const cr = field.replay(a, b);
  assert.equal(cr.from, a.id, 'replay.from is a.id');
  assert.equal(cr.to, b.id, 'replay.to is b.id');
  assert.ok(Array.isArray(cr.steps), 'steps is an array');
  field.destroy();
});

test('replay() honours a focus option (delegation passes opts through)', () => {
  const field = makeFixture();
  const a = field.snapshot();
  const b = field.snapshot();
  const cr = field.replay(a, b, { focus: a.bodies[0]?.id });
  assert.ok(Array.isArray(cr.steps), 'steps present with focus opt');
  if (cr.focus !== undefined) assert.equal(typeof cr.focus, 'string', 'focus echoed as a string');
  field.destroy();
});

// ── projections registry ─────────────────────────────────────────────────────

const sampleProjection = () => {
  let lastWrite: { key: string; value: string } | null = null;
  const projection = {
    id: 'density-tint',
    label: 'Density tint',
    channels: ['density'],
    surfaces: ['css'] as const,
    reducedMotionEquivalent: 'static density swatch',
    apply(reading: Record<string, number>, target: { style?: { setProperty(k: string, v: string): void } }) {
      const d = reading.density ?? 0;
      target.style?.setProperty('--density', String(d));
    },
  };
  return { projection, getLastWrite: () => lastWrite, setLastWrite: (w: typeof lastWrite) => { lastWrite = w; } };
};

test('projections.register() makes the projection visible in list()', () => {
  const field = makeFixture();
  const reg = field.projections;
  assert.equal(reg.list().some((p) => p.id === 'density-tint'), false, 'not registered yet');
  const { projection } = sampleProjection();
  const unregister = reg.register(projection);
  assert.equal(typeof unregister, 'function', 'register returns an unregister fn');
  const info = reg.list().find((p) => p.id === 'density-tint');
  assert.ok(info, 'projection appears in list()');
  assert.equal(info!.label, 'Density tint', 'metadata carried');
  assert.deepEqual(info!.channels, ['density'], 'channels carried');
  assert.deepEqual(info!.surfaces, ['css'], 'surfaces carried');
  assert.equal(info!.reducedMotionEquivalent, 'static density swatch', 'reduced-motion equivalent carried');
  field.destroy();
});

test('projections.get() returns the full projection incl. apply', () => {
  const field = makeFixture();
  const { projection } = sampleProjection();
  field.projections.register(projection);
  const got = field.projections.get('density-tint');
  assert.ok(got, 'get() returns the projection');
  assert.equal(typeof got!.apply, 'function', 'apply present on the full record');
  assert.equal(field.projections.get('nope'), undefined, 'unknown id is undefined');
  field.destroy();
});

test('a registered projection.apply() writes to a target object', () => {
  const field = makeFixture();
  const { projection } = sampleProjection();
  field.projections.register(projection);
  const written: Record<string, string> = {};
  const target = { style: { setProperty: (k: string, v: string) => { written[k] = v; } } };
  field.projections.apply('density-tint', { density: 0.42 }, target);
  assert.equal(written['--density'], '0.42', 'projection wrote the channel onto the target');
  field.destroy();
});

test('projections.apply() on an unknown id is a no-op (does not throw)', () => {
  const field = makeFixture();
  const target = { style: { setProperty: () => { throw new Error('should not be called'); } } };
  assert.doesNotThrow(() => field.projections.apply('missing', { density: 1 }, target));
  field.destroy();
});

test('unregister() removes the projection from list() — both the returned fn and by id', () => {
  const field = makeFixture();
  const reg = field.projections;
  const { projection } = sampleProjection();
  const off = reg.register(projection);
  assert.ok(reg.list().some((p) => p.id === 'density-tint'), 'registered');
  off();
  assert.equal(reg.list().some((p) => p.id === 'density-tint'), false, 'returned fn unregisters');
  // re-register, then remove by id
  reg.register(projection);
  reg.unregister('density-tint');
  assert.equal(reg.list().some((p) => p.id === 'density-tint'), false, 'unregister(id) removes it');
  field.destroy();
});

test('a registered projection is reported by query() and snapshot()', () => {
  const field = makeFixture();
  const { projection } = sampleProjection();
  field.projections.register(projection);
  const q = field.query();
  assert.ok(q.projections.some((p) => p.id === 'density-tint'), 'query() reports the projection');
  const s = field.snapshot();
  assert.ok(s.projections.some((p) => p.id === 'density-tint'), 'snapshot() reports the projection');
  field.destroy();
});

// ── the full round-trip woven together ───────────────────────────────────────

test('end-to-end: register → snapshot×2 → diff & replay all reflect substrate state', () => {
  const field = makeFixture();
  const { projection } = sampleProjection();
  field.projections.register(projection);

  const a = field.snapshot({ includeParticles: true });
  const b = field.snapshot();

  // both snapshots see the registered projection and the dynamic body authority
  assert.ok(a.projections.some((p) => p.id === 'density-tint'), 'snapshot a sees projection');
  assert.ok(a.bodies.some((bd) => bd.authority === 'dynamic'), 'snapshot a sees dynamic body');

  const d = field.diff(a, b);
  assert.equal(d.from, a.id);
  assert.equal(d.to, b.id);

  const cr = field.replay(a, b);
  assert.equal(cr.from, a.id);
  assert.equal(cr.to, b.id);
  assert.ok(Array.isArray(cr.steps));

  field.destroy();
});
