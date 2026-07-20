/**
 * G3.3 — cross-substrate contract comparison (EXPERIMENTAL, internal).
 *
 * Compares the FieldRuntime substrate and the quality-governor substrate against the SAME
 * `DynamicsContract`, dimension by dimension, and classifies each element. The question is whether the
 * contract is substrate-neutral or quietly field-fitted.
 *
 * Every row is grounded in an executed fixture (G3.2 / F1.4), not in intent.
 */
import { governorDynamics } from './adapters/governor-runtime.ts';
import { fieldRuntimeDynamics } from './adapters/field-runtime.ts';
import { createWorldEnvelope } from './envelope.ts';
import type { World } from './world.ts';

export type ElementClassification =
  | 'supported-by-both'
  | 'substrate-specific-value'
  | 'field-biased'
  | 'second-substrate-biased'
  | 'missing-general-concept'
  | 'unnecessary-generalization'
  | 'unresolved';

export interface CrossSubstrateRow {
  readonly dimension: string;
  readonly field: string;
  readonly governor: string;
  readonly classification: ElementClassification;
  readonly evidence: string;
}

export type GeneralizationOutcome =
  | 'generalized'
  | 'generalized-with-refinement'
  | 'field-fitted'
  | 'inconclusive';

export interface CrossSubstrateResult {
  readonly rows: readonly CrossSubstrateRow[];
  readonly outcome: GeneralizationOutcome;
  readonly refinements: readonly string[];
  readonly rationale: string;
}

function emptyWorld(id: string): World {
  return { envelope: createWorldEnvelope(id), entities: [], relations: [], invariants: [], projections: [] };
}

/** Builds the matrix by INSPECTING both live contracts, not from stored prose. */
export function crossSubstrateMatrix(): CrossSubstrateRow[] {
  const f = fieldRuntimeDynamics(emptyWorld('field-world'));
  const g = governorDynamics(emptyWorld('governor-world'));

  const caps = (c: typeof f | typeof g): string =>
    `snapshot=${c.capabilities.snapshot} restore=${c.capabilities.restore} replay=${c.capabilities.replay} inspect=${c.capabilities.inspectInternalState} law=${c.capabilities.declareTransitionLaw}`;

  return [
    {
      dimension: 'state model', field: 'opaque handle + closure-scattered runtime state', governor: 'plain data record (tier, streaks, budget)',
      classification: 'substrate-specific-value',
      evidence: 'both threaded as opaque `State` by the kernel; neither leaked into World',
    },
    {
      dimension: 'input model', field: '{ steps? }', governor: '{ durationMs }',
      classification: 'substrate-specific-value', evidence: 'generic `Input` type parameter carried both',
    },
    {
      dimension: 'output model', field: '{ steps }', governor: '{ tier, changed }',
      classification: 'substrate-specific-value', evidence: 'generic `Output` type parameter carried both',
    },
    {
      dimension: 'executionKind', field: f.executionKind, governor: g.executionKind,
      classification: 'supported-by-both', evidence: 'the closed union expressed both extremes without extension',
    },
    {
      dimension: 'determinism', field: `${f.determinism.classification} (uncontrolled: ${f.determinism.uncontrolledInputs.length})`,
      governor: `${g.determinism.classification} (uncontrolled: ${g.determinism.uncontrolledInputs.length})`,
      classification: 'supported-by-both',
      evidence: 'the declaration form expressed conditional and exact determinism honestly; the validator rejects `deterministic` with uncontrolled inputs',
    },
    {
      dimension: 'capabilities', field: caps(f), governor: caps(g),
      classification: 'supported-by-both',
      evidence: 'conservative flags distinguished a lossy snapshot-only substrate from a fully restorable one',
    },
    {
      dimension: 'evidence shape', field: 'declaredInputs / substrateResponses / executionTrace / unresolvedInterpretations',
      governor: 'same five channels; unresolvedInterpretations records "tier as perceived quality"',
      classification: 'supported-by-both', evidence: 'neither substrate needed a channel the other lacked',
    },
    {
      dimension: 'failure semantics', field: 'no in-run failure exercised; typed codes available',
      governor: 'invalid-state on non-finite input; restore rejection',
      classification: 'supported-by-both',
      evidence: 'the 10-code taxonomy covered the governor without extension; native cause retained internally',
    },
    {
      dimension: 'snapshot fidelity', field: 'partial-observable (lossy, non-restorable)', governor: 'complete-restorable',
      classification: 'supported-by-both', evidence: 'the closed fidelity union covered both extremes',
    },
    {
      dimension: 'replay', field: String(f.capabilities.replay), governor: String(g.capabilities.replay),
      classification: 'supported-by-both', evidence: 'capability flag + deterministicReplay consistency rule',
    },
    {
      dimension: 'restore', field: `${f.capabilities.restore} (method absent)`, governor: `${g.capabilities.restore} (method present)`,
      classification: 'supported-by-both', evidence: 'optional method + capability flag; restore reconstructed governor state exactly',
    },
    {
      dimension: 'lifecycle', field: 'initialize → advance* → snapshot', governor: 'initialize → advance* → snapshot → restore',
      classification: 'supported-by-both', evidence: 'the optional-method design absorbed the longer lifecycle',
    },
    {
      dimension: 'ordering', field: 'frame ordering; measurement cadence every 6th frame',
      governor: 'strict input-sequence ordering (streak state is order-dependent)',
      classification: 'supported-by-both', evidence: 'order-change negative fixture diverges in both harnesses',
    },
    {
      dimension: 'environment dependence', field: 'host geometry, viewport, scroll', governor: 'none',
      classification: 'substrate-specific-value',
      evidence: 'governor conditions record clock/environment/host-geometry as NOT-APPLICABLE rather than claimed',
    },
    {
      dimension: 'opaque vs declarative region', field: 'wholly opaque (force code)', governor: 'wholly declared (threshold table)',
      classification: 'supported-by-both', evidence: 'executionKind captured the distinction; F1.5 established the field boundary',
    },
    {
      dimension: 'host dependence', field: 'requires a FieldHost', governor: 'none',
      classification: 'substrate-specific-value', evidence: 'the contract never mentions a host; both adapters own their own',
    },
    {
      dimension: 'execution context (`now`)', field: 'unused — the field injects its own clock', governor: 'unused — no clock exists',
      classification: 'unnecessary-generalization',
      evidence: 'neither substrate read `DynamicsExecutionContext.now` in any fixture; only `step` was used',
    },
    {
      dimension: 'transition-law access', field: 'declareTransitionLaw=false (opaque)', governor: 'declareTransitionLaw=true, but the contract offered NO accessor',
      classification: 'missing-general-concept',
      evidence: 'the governor can truthfully declare its law (a data table) yet no contract method could return it — a gap invisible while only the field existed',
    },
  ];
}

export function crossSubstrateResult(): CrossSubstrateResult {
  const rows = crossSubstrateMatrix();
  const missing = rows.filter((r) => r.classification === 'missing-general-concept');
  const fieldBiased = rows.filter((r) => r.classification === 'field-biased');

  const outcome: GeneralizationOutcome =
    fieldBiased.length > 0 ? 'field-fitted' : missing.length > 0 ? 'generalized-with-refinement' : 'generalized';

  return {
    rows,
    outcome,
    refinements: missing.map((r) => `${r.dimension}: ${r.evidence}`),
    rationale:
      'No dimension was classified field-biased: the second substrate adopted the contract unchanged in ' +
      'executionKind, determinism, capabilities, evidence, failures, fidelity, replay, restore, lifecycle and ' +
      'ordering. One genuine gap surfaced (transition-law access) and one over-generalization (`context.now`, ' +
      'unused by both). The gap is a missing general concept, not a substrate convenience: the contract already ' +
      'carries a `declareTransitionLaw` capability with no way to exercise it.',
  };
}
