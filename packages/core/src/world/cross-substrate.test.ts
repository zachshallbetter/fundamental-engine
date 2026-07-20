/**
 * G3.3 — cross-substrate generalization tests + the second adapter's architecture guards.
 *
 * Establishes whether `DynamicsContract` is substrate-neutral or field-fitted, and pins the ONE
 * refinement the second substrate justified (transition-law access), including negative fixtures for
 * the new consistency rule and a migration check that the field adapter is unaffected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crossSubstrateMatrix, crossSubstrateResult } from './cross-substrate.ts';
import { validateDynamicsContract } from './dynamics.ts';
import type { DynamicsCapabilities, DynamicsContract } from './dynamics.ts';
import { governorDynamics } from './adapters/governor-runtime.ts';
import { worldFromCompiledPattern, fieldRuntimeDynamics } from './adapters/field-runtime.ts';
import { createWorldEnvelope } from './envelope.ts';
import { ESCALATE_RULES, RECOVER_STREAK } from './substrates/governor.ts';
import type { World } from './world.ts';
import type { FieldRecipe } from '../recipes/schema.ts';
import type { CompiledPattern } from '../recipes/compile.ts';

const here = dirname(fileURLToPath(import.meta.url));

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function world(): World {
  return { envelope: createWorldEnvelope('governor-world'), entities: [], relations: [], invariants: [], projections: [] };
}

function fieldContract() {
  const compiled: CompiledPattern = {
    id: 'p', recipe: { id: 'p' } as unknown as FieldRecipe,
    bodies: [{ attributes: { 'data-body': 'attract' }, tokens: ['attract'] }],
    relationships: [], feedback: [], diagnostics: [], metrics: [], conditions: [],
    render: { underlay: null, overlay: [], heatmap: false, unapplied: [] },
    reducedMotion: { reducedMotion: 'none', meaningWithoutMotion: '', staticOutputs: [] },
  };
  return fieldRuntimeDynamics(worldFromCompiledPattern(compiled).world);
}

const CAPS: DynamicsCapabilities = {
  initialize: true, advance: true, snapshot: false, restore: false, replay: false,
  inspectInternalState: false, declareTransitionLaw: false, deterministicReplay: false,
};

// ---------------------------------------------------------------- Part D: the finding

test('G3.3 matrix covers every required dimension, each row grounded in a live contract', () => {
  const rows = crossSubstrateMatrix();
  const required = [
    'state model', 'input model', 'output model', 'executionKind', 'determinism', 'capabilities',
    'evidence shape', 'failure semantics', 'snapshot fidelity', 'replay', 'restore', 'lifecycle',
    'ordering', 'environment dependence', 'opaque vs declarative region', 'host dependence',
  ];
  for (const d of required) {
    assert.ok(rows.some((r) => r.dimension === d), `matrix must cover "${d}"`);
  }
  // rows are read off the live contracts, so these must reflect actual declarations
  assert.ok(rows.some((r) => r.dimension === 'executionKind' && r.field === 'opaque-native' && r.governor === 'interpreted'));
  assert.ok(rows.every((r) => r.evidence.length > 0), 'no row may be asserted without evidence');
});

test('G3.3 outcome: generalized-with-refinement — no dimension is field-biased', () => {
  const r = crossSubstrateResult();
  assert.equal(r.rows.filter((x) => x.classification === 'field-biased').length, 0,
    'a field-biased dimension would mean the contract was fitted to the field (permanent stop)');
  assert.equal(r.rows.filter((x) => x.classification === 'second-substrate-biased').length, 0);
  assert.equal(r.outcome, 'generalized-with-refinement');
  assert.equal(r.refinements.length, 1, 'exactly one missing general concept was demonstrated');
  assert.match(r.refinements[0]!, /transition-law/);
  // the over-generalization is RECORDED, not silently removed
  assert.ok(r.rows.some((x) => x.classification === 'unnecessary-generalization' && /now/.test(x.dimension)));
});

test('G3.3 unresolved rows are not hidden', () => {
  const unresolved = crossSubstrateMatrix().filter((r) => r.classification === 'unresolved');
  assert.deepEqual(unresolved, [], 'no dimension was left unresolved in this phase');
});

// ------------------------------------------------- the refinement the evidence justified

test('G3.3 refinement: the governor can now RETURN its declared law as data', () => {
  const c = governorDynamics(world());
  assert.equal(typeof c.describeTransitionLaw, 'function');
  const law = c.describeTransitionLaw!();
  assert.ok(law.ok);
  assert.equal(law.value.kind, 'threshold-table');
  // the returned law must match the substrate's ACTUAL table, not a restatement
  const escalate = law.value.rules.filter((r) => r.kind === 'escalate');
  assert.equal(escalate.length, ESCALATE_RULES.length);
  escalate.forEach((r, i) => {
    assert.equal(r.aboveMs, ESCALATE_RULES[i]!.aboveMs);
    assert.equal(r.streak, ESCALATE_RULES[i]!.streak);
    assert.equal(r.tier, ESCALATE_RULES[i]!.tier);
  });
  assert.ok(law.value.rules.some((r) => r.kind === 'recover' && r.cleanStreak === RECOVER_STREAK));
});

test('G3.3 negative: declareTransitionLaw:true without an accessor is now rejected', () => {
  const bad = {
    executionKind: 'interpreted' as const,
    capabilities: { ...CAPS, declareTransitionLaw: true },
    determinism: { classification: 'deterministic' as const, controlledInputs: [], uncontrolledInputs: [], requirements: [] },
  };
  const problems = validateDynamicsContract(bad);
  assert.ok(problems.some((p) => p.rule === 'declareTransitionLaw⇒describeTransitionLaw'),
    'a capability that cannot be exercised is an incoherent declaration');
});

test('G3.3 negative: an accessor without the capability claim is rejected', () => {
  const bad = {
    executionKind: 'interpreted' as const,
    capabilities: { ...CAPS, declareTransitionLaw: false },
    determinism: { classification: 'deterministic' as const, controlledInputs: [], uncontrolledInputs: [], requirements: [] },
    describeTransitionLaw: () => ({ ok: true as const, value: { kind: 'x', rules: [] }, evidence: undefined }),
  } as unknown as Parameters<typeof validateDynamicsContract>[0];
  assert.ok(validateDynamicsContract(bad).some((p) => p.rule === 'describeTransitionLaw⇒declareTransitionLaw'));
});

test('G3.3 negative: opaque-native still cannot declare a law, accessor or not', () => {
  const bad = {
    executionKind: 'opaque-native' as const,
    capabilities: { ...CAPS, declareTransitionLaw: true },
    determinism: { classification: 'unknown' as const, controlledInputs: [], uncontrolledInputs: ['clock'], requirements: [] },
    describeTransitionLaw: () => ({ ok: true as const, value: { kind: 'x', rules: [] }, evidence: undefined }),
  } as unknown as Parameters<typeof validateDynamicsContract>[0];
  assert.ok(validateDynamicsContract(bad).some((p) => p.rule === 'law∦opaque-native'));
});

test('G3.3 migration: the field adapter is unaffected by the refinement', () => {
  const c = fieldContract();
  assert.deepEqual(validateDynamicsContract(c), [], 'field contract remains self-consistent after the refinement');
  assert.equal(c.capabilities.declareTransitionLaw, false);
  assert.equal(c.describeTransitionLaw, undefined, 'an opaque substrate must NOT gain a law accessor');
});

// ------------------------------------------------------ Part B: second-adapter guards

test('G3 guard: the generic contract stays free of substrate-specific imports', () => {
  for (const file of ['world.ts', 'dynamics.ts', 'kernel.ts', 'envelope.ts']) {
    const src = stripComments(readFileSync(join(here, file), 'utf8'));
    for (const p of [/\bGovernor/, /\bFsm\b/, /\bPlanner/, /substrates\//]) {
      assert.ok(!p.test(src), `${file} must not match ${p} — the kernel must not know any substrate`);
    }
  }
});

test('corpus guard: each substrate is written without knowledge of the contract', () => {
  // the corpus protocol depends on this: a substrate that imports the contract could be shaped to fit it
  for (const f of [join(here, 'substrates', 'fsm.ts'), join(here, 'substrates', 'planner.ts'), join(here, 'substrates', 'governor.ts')]) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const p of [/DynamicsContract/, /from ['"].*dynamics/, /from ['"].*kernel/, /from ['"].*world\.ts/]) {
      assert.ok(!p.test(src), `${f} must not match ${p} — substrate-first means substrate-unaware`);
    }
  }
});

test('G3 guard: the second adapter introduces no any/Function/eval/callback escape hatch', () => {
  const files = [
    join(here, 'adapters', 'governor-runtime.ts'),
    join(here, 'substrates', 'governor.ts'),
    join(here, 'governor-equivalence.ts'),
    join(here, 'cross-substrate.ts'),
    join(here, 'projection', 'projection.ts'),
    join(here, 'properties', 'properties.ts'),
    join(here, 'substrates', 'fsm.ts'),
    join(here, 'substrates', 'planner.ts'),
    join(here, 'adapters', 'fsm-runtime.ts'),
    join(here, 'adapters', 'planner-runtime.ts'),
    join(here, 'conformance', 'corpus.ts'),
  ];
  const forbidden: RegExp[] = [/:\s*any\b/, /<any[>,]/, /\bFunction\b/, /\beval\(/, /new Function/, /\bimportScripts\b/];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const p of forbidden) assert.ok(!p.test(src), `${f} must not match ${p}`);
  }
});

test('F2 guard: the projection and property foundations stay field-free and substrate-free', () => {
  for (const f of [join(here, 'projection', 'projection.ts'), join(here, 'properties', 'properties.ts')]) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const p of [/\bFieldPattern\b/, /\bFieldRuntime\b/, /\bFieldHandle\b/, /engine\/field/, /\bGovernor/, /substrates\//]) {
      assert.ok(!p.test(src), `${f} must not match ${p}`);
    }
  }
});

test('G3 guard: the native governor type never leaks into World', () => {
  const w = world();
  const c = governorDynamics(w);
  const init = c.initialize({ declaration: w });
  assert.ok(init.ok);
  const snap = c.snapshot!(init.value, { step: 0 });
  assert.ok(snap.ok);
  // the generic reading is plain data — numbers only, no substrate object
  for (const v of Object.values(snap.value.reading.metrics)) {
    assert.equal(typeof v, 'number', 'World-visible metrics must be plain scalars');
  }
  const worldSrc = stripComments(readFileSync(join(here, 'world.ts'), 'utf8'));
  assert.ok(!/GovernorState|QualityTier/.test(worldSrc));
});

test('G3 guard: failures project through the generic taxonomy while retaining native cause', () => {
  const w = world();
  const c = governorDynamics(w);
  const init = c.initialize({ declaration: w });
  assert.ok(init.ok);
  const bad = c.advance(init.value, { durationMs: Number.NEGATIVE_INFINITY }, { step: 1 });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    // generic code on the surface...
    assert.equal(bad.error.code, 'invalid-state');
    assert.ok(!/Governor|QualityTier/.test(bad.error.message), 'no native type on the generic surface');
    // ...native detail retained internally, not erased
    assert.ok(bad.error.cause !== undefined);
  }
});
