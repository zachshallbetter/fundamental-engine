/**
 * Agent permissions + redactions + snapshot profiles (feat/agent-permissions).
 *
 * The scoped, READ-ONLY surface a Software Agent uses to read the field safely — the safety layer over
 * the query/snapshot substrate (`agent-readable is NOT agent-writable`). Covers:
 *  - capability scoping: a reading omits the dimensions the caps don't grant (tightens, never widens);
 *  - redactions: dotted paths are stripped from every reading, after capability scoping;
 *  - snapshot profiles: compose with include* flags + privacy policy, resolving to the TIGHTEST result;
 *  - the facade shape: no mutation methods; `replay` present only when `read:replay` is granted;
 *  - policy respect: an agent view can never widen past what FieldPolicy already permits, and
 *    `budgets.agentRead === 0` closes the surface to the most-restricted view.
 *
 * Lives at the top level (`src/*.test.ts`) so it sits in the corpus the RC-6 contract-coverage guard scans.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './core/field.ts';
import type { FieldHost } from './core/host.ts';

function stubHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

function fieldWithBodies(policy?: Parameters<typeof createField>[1] extends infer O ? O extends { policy?: infer P } ? P : never : never): ReturnType<typeof createField> {
  const field = createField({} as HTMLCanvasElement, { host: stubHost(), render: 'none', policy });
  const a = field.addBody({ tokens: ['gravity'], identity: 'a', data: { secret: 42 }, rect: () => ({ left: 100, top: 100, width: 40, height: 40 }) });
  const b = field.addBody({ tokens: ['attract'], identity: 'b', data: { secret: 7 }, rect: () => ({ left: 300, top: 300, width: 40, height: 40 }) });
  field.addEdge(a, b, { type: 'link', strength: 0.5 });
  return field;
}

test('forAgent: query scopes out ungranted dimensions (metrics/relationships/influences)', () => {
  const field = fieldWithBodies();
  try {
    const view = field.forAgent({ capabilities: ['read:metrics'] });
    const r = view.query();
    assert.ok(r.bodies.length >= 2, 'bodies always readable (base identity grant)');
    assert.notDeepEqual(r.metrics, {}, 'read:metrics granted → metrics present');
    assert.deepEqual(r.relationships, [], 'no read:relationships → relationships stripped');
    assert.deepEqual(r.influences, [], 'no read:influences → influences stripped');
    assert.deepEqual(r.projections, [], 'no read:projections → projections stripped');
  } finally {
    field.destroy();
  }
});

test('forAgent: read:relationships surfaces relationships; without it they are stripped', () => {
  const field = fieldWithBodies();
  try {
    const withRel = field.forAgent({ capabilities: ['read:relationships'] });
    const without = field.forAgent({ capabilities: ['read:metrics'] });
    assert.deepEqual(without.query().relationships, []);
    // whatever the field reports, the granted view must not empty it out on our behalf.
    const full = field.query();
    assert.equal(withRel.query().relationships.length, full.relationships.length);
  } finally {
    field.destroy();
  }
});

test('forAgent: snapshot withholds body.data unless read:body-data is granted', () => {
  const field = fieldWithBodies();
  try {
    const noData = field.forAgent({ capabilities: ['read:snapshots'] });
    // even when the agent explicitly asks for data, the missing cap withholds it (tightens, never widens).
    const s1 = noData.snapshot({ includeData: true });
    assert.ok(s1.bodies.every((b) => b.data === undefined), 'no read:body-data → data withheld even with includeData');

    const withData = field.forAgent({ capabilities: ['read:body-data'] });
    const s2 = withData.snapshot({ includeData: true });
    assert.ok(s2.bodies.some((b) => b.data !== undefined), 'read:body-data → data present when asked + policy permits');
  } finally {
    field.destroy();
  }
});

test('forAgent: redactions strip dotted paths after capability scoping', () => {
  const field = fieldWithBodies();
  try {
    const view = field.forAgent({ capabilities: ['read:body-data', 'read:metrics'], redactions: ['body.data', 'metrics.bodies'] });
    const s = view.snapshot({ includeData: true });
    assert.ok(s.bodies.every((b) => b.data === undefined), 'body.data redacted from every snapshot body');
    const q = view.query();
    assert.ok(!('bodies' in q.metrics), 'metrics.bodies redacted from the metrics record');
  } finally {
    field.destroy();
  }
});

test('forAgent: the facade exposes NO mutation methods (agent-readable is not agent-writable)', () => {
  const field = fieldWithBodies();
  try {
    const view = field.forAgent({ capabilities: ['read:metrics'] }) as unknown as Record<string, unknown>;
    for (const mutator of ['applyForce', 'addBody', 'setPolicy', 'setRender', 'burst', 'destroy']) {
      assert.equal(view[mutator], undefined, `facade must not expose ${mutator}`);
    }
  } finally {
    field.destroy();
  }
});

test('forAgent: replay is present ONLY when read:replay is granted', () => {
  const field = fieldWithBodies();
  try {
    assert.equal(field.forAgent({ capabilities: ['read:snapshots'] }).replay, undefined, 'no read:replay → no replay method');
    assert.equal(typeof field.forAgent({ capabilities: ['read:replay'] }).replay, 'function', 'read:replay → replay present');
  } finally {
    field.destroy();
  }
});

test('snapshot profiles: resolve to the tightest inclusion; agent/public withhold data', () => {
  const field = fieldWithBodies();
  try {
    // debug = everything (data still gated by policy, which permits by default here).
    const dbg = field.snapshot({ profile: 'debug', includeData: true });
    assert.ok(dbg.bodies.some((b) => b.data !== undefined), 'debug profile includes body data');
    assert.ok(dbg.influences !== undefined, 'debug profile includes influences');

    // agent profile: influences yes, opaque data NO — even when includeData asks for it (tightest wins).
    const ag = field.snapshot({ profile: 'agent', includeData: true });
    assert.ok(ag.bodies.every((b) => b.data === undefined), 'agent profile withholds opaque body data');
    assert.ok(ag.influences !== undefined, 'agent profile keeps influence attribution');

    // public profile: minimal — no relationships, no influences, no data.
    const pub = field.snapshot({ profile: 'public', includeData: true, includeInfluences: true });
    assert.deepEqual(pub.relationships, [], 'public profile drops relationships');
    assert.equal(pub.influences, undefined, 'public profile drops influences even when asked');
    assert.ok(pub.bodies.every((b) => b.data === undefined), 'public profile withholds data');
  } finally {
    field.destroy();
  }
});

test('forAgent: an agent view can never widen past what policy already forbids', () => {
  // policy forbids body data outright; even read:body-data + includeData cannot surface it.
  const field = fieldWithBodies({ allowBodyDataInSnapshots: false });
  try {
    const view = field.forAgent({ capabilities: ['read:body-data'] });
    const s = view.snapshot({ includeData: true });
    assert.ok(s.bodies.every((b) => b.data === undefined), 'policy deny wins over the agent view grant');
  } finally {
    field.destroy();
  }
});

test('forAgent: budgets.agentRead === 0 closes the surface to the most-restricted view', () => {
  const field = fieldWithBodies({ budgets: { agentRead: 0 } });
  try {
    const view = field.forAgent({ capabilities: ['read:metrics', 'read:relationships', 'read:influences', 'read:projections'] });
    const q = view.query();
    assert.deepEqual(q.metrics, {}, 'closed agentRead budget → no metrics');
    assert.deepEqual(q.relationships, [], 'closed agentRead budget → no relationships');
    assert.deepEqual(q.influences, [], 'closed agentRead budget → no influences');
    const s = view.snapshot({ profile: 'debug', includeData: true });
    assert.ok(s.bodies.every((b) => b.data === undefined), 'closed agentRead budget → snapshot falls to public (no data)');
  } finally {
    field.destroy();
  }
});

// ─── Facade completeness drift guard (safety-relevant) ────────────────────────────────────────────
// The `forAgent` facade exposes a DELIBERATELY SMALL, read-only slice of the `FieldHandle` surface —
// mutators (addBody, burst, seed, setPolicy, …) must never leak onto an agent view. Nothing structural
// forces a *new* `FieldHandle` method to be considered: it would simply be absent from the facade (the
// safe default) — but "absent by omission" and "absent by decision" are indistinguishable, so a method
// that SHOULD be agent-exposed (a new read) could be silently withheld, or a reviewer could miss that a
// new method needs a conscious agent-exposure decision. This guard makes the decision explicit: every
// FieldHandle method must be named in exactly one of the two partitions below. A new method fails the
// build until it is placed — into AGENT_EXPOSED (and the facade is extended to serve it) or
// AGENT_WITHHELD (kept off the agent surface on purpose).

// The methods the agent facade DOES surface (read-only; `replay` is capability-gated but still exposed).
const AGENT_EXPOSED = new Set<string>(['query', 'snapshot', 'replay']);

// Every other FieldHandle method — mutators, lifecycle, low-level readers — kept OFF the agent view.
const AGENT_WITHHELD = new Set<string>([
  // lifecycle / scanning
  'scan', 'rescan', 'destroy', 'setVisible',
  // mutators: appearance / behavior toggles
  'setAccent', 'setPalette', 'setFormation', 'setWaveStyle', 'setWaveCenter', 'setSeparation',
  'setAttention', 'setCausality', 'setHeatmap', 'setDprCap', 'setQualityTier', 'setRender',
  'setOverlay', 'setBackground', 'setPolicy',
  // mutators: matter / bodies / edges / flow / threads
  'threads', 'burst', 'flowTo', 'clearFlow', 'seed', 'addAgent', 'addBody', 'addEdge',
  'addField', 'registerOverlay',
  // point / particle / grid readers (raw substrate, not the scoped agent reading)
  'readEdges', 'atomAt', 'focusAt', 'clearFocus', 'sampleField', 'particleCount', 'readParticles',
  'readParticleIds', 'readParticleChannels', 'energy', 'sample', 'sampleScalar', 'sampleGradient',
  'grid', 'scrollV',
  // diff is a pure static helper on the handle; the agent composes query/snapshot instead
  'diff',
  // events + the facade factory itself are never re-exposed through the facade
  'on', 'forAgent',
]);

test('forAgent: every FieldHandle method is explicitly exposed OR withheld (facade drift guard)', () => {
  const field = fieldWithBodies();
  try {
    const handleMethods = new Set(
      (Object.keys(field) as Array<keyof typeof field>).filter((k) => typeof field[k] === 'function') as string[],
    );
    assert.ok(handleMethods.size > 20, `sanity: expected a rich handle surface, got ${handleMethods.size}`);

    const partitioned = new Set<string>([...AGENT_EXPOSED, ...AGENT_WITHHELD]);
    // No name may sit in both partitions.
    const both = [...AGENT_EXPOSED].filter((m) => AGENT_WITHHELD.has(m));
    assert.deepEqual(both, [], `method(s) in BOTH AGENT_EXPOSED and AGENT_WITHHELD: ${both.join(', ')}`);

    // Every real handle method must be partitioned — a NEW method forces a conscious decision.
    const unpartitioned = [...handleMethods].filter((m) => !partitioned.has(m)).sort();
    assert.deepEqual(
      unpartitioned,
      [],
      `FieldHandle method(s) not classified for the agent facade: ${unpartitioned.join(', ')}. ` +
        `Add each to AGENT_EXPOSED (and extend forAgent to serve it) or AGENT_WITHHELD (keep it off the agent view) — ` +
        `this is a SAFETY decision, don't skip it.`,
    );
    // No stale names: every partitioned name must be a real handle method.
    const stale = [...partitioned].filter((m) => !handleMethods.has(m)).sort();
    assert.deepEqual(stale, [], `partition names a method that no longer exists on FieldHandle: ${stale.join(', ')}`);
  } finally {
    field.destroy();
  }
});

test('forAgent: a fully-granted agent view exposes ONLY the AGENT_EXPOSED methods (no mutator leak)', () => {
  const field = fieldWithBodies();
  try {
    // grant everything so any conditionally-attached method (e.g. replay) is present.
    const view = field.forAgent({
      capabilities: [
        'read:metrics', 'read:relationships', 'read:influences', 'read:body-data',
        'read:snapshots', 'read:replay', 'read:projections',
      ],
    });
    const viewMethods = new Set(
      (Object.keys(view) as Array<keyof typeof view>).filter((k) => typeof view[k] === 'function') as string[],
    );
    const leaked = [...viewMethods].filter((m) => !AGENT_EXPOSED.has(m)).sort();
    assert.deepEqual(leaked, [], `agent view exposes method(s) not in AGENT_EXPOSED (mutator/reader leak): ${leaked.join(', ')}`);
    // and everything promised is actually present on a fully-granted view.
    const absent = [...AGENT_EXPOSED].filter((m) => !viewMethods.has(m)).sort();
    assert.deepEqual(absent, [], `AGENT_EXPOSED names a method the fully-granted agent view does not surface: ${absent.join(', ')}`);
  } finally {
    field.destroy();
  }
});
