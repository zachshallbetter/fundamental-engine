/**
 * Normalized evidence log (EXPERIMENTAL, internal) — Phase O2.
 *
 * The Observatory is an inspection instrument, not a source of findings. This file defines the
 * artifact that separates the two: the runtime EMITS an evidence log; the Observatory RENDERS it and
 * derives nothing. Core exports nothing publicly and imports no DOM, so this boundary is enforced by
 * the package layout rather than by convention.
 *
 *     living system → instrumentation adapter → normalized evidence log → observatory
 *
 * Every visible statement in the Observatory must reduce to a node in this log, and every node names
 * the runtime function that produced it (`origin`). A node with no origin cannot be displayed as a
 * finding, because nothing in the runtime claimed it.
 *
 * Deliberately reuses existing runtime types (`OpportunityResult`, `DetectionResult`, `AblationRecord`,
 * `ProjectionResult`, `DynamicsEvidence`, …) rather than restating them. New types appear ONLY where
 * several sources had to be represented uniformly — the evidence node and the recorded transition.
 */
import type { DynamicsCapabilities, DynamicsEvidence, DynamicsExecutionKind, DeterminismDeclaration, TransitionLifecycle } from '../dynamics.ts';
import type { OpportunityResult } from '../opportunity/opportunity.ts';
import type { DetectionContract, DetectionResult } from '../episodes/episodes.ts';
import type { AblationRecord } from '../ablation/ablation.ts';
import type { ProjectionResult } from '../projection/projection.ts';
import type { ConformanceReport, CorpusEntry, CorpusLedger } from '../conformance/corpus.ts';
import type { Discovery } from '../conformance/discoveries.ts';
import type { Prediction, PredictionAccuracy } from '../conformance/predictions.ts';
import type { NegativeResult, NegativeLedger } from '../conformance/negative-results.ts';
import type { ProjectionClaim, EvidenceProfile } from '../projection/evidence-profile.ts';

/** What a piece of evidence IS. The Observatory groups and filters by this, never by substrate. */
export type EvidenceNodeKind =
  | 'raw-event'
  | 'adapter-output'
  | 'runtime-derivation'
  | 'registry-entry'
  | 'prediction'
  | 'discovery'
  | 'negative-result';

/**
 * One node in the evidence DAG. `derivedFrom` makes every edge citable: an Observatory pane showing a
 * conclusion can walk back to the inputs the runtime actually used.
 */
export interface EvidenceNode {
  readonly id: string;
  readonly kind: EvidenceNodeKind;
  /** The runtime function that produced this. Provenance — never a UI label. */
  readonly origin: string;
  readonly label: string;
  readonly step?: number;
  readonly payload: unknown;
  readonly derivedFrom: readonly string[];
}

/**
 * How a piece of world state became visible. `inferred` exists in the vocabulary so the Observatory can
 * show that the count is ZERO — the runtime never infers state, and an absent category is invisible.
 */
export type StateVisibility = 'declared' | 'observed' | 'reconstructed' | 'inferred' | 'unavailable';

export interface StateFact {
  readonly key: string;
  readonly visibility: StateVisibility;
  readonly value?: number;
  /** Why it carries this visibility, sourced from the runtime (e.g. a coverage classification). */
  readonly basis: string;
  readonly evidenceId?: string;
}

export interface RecordedTransition {
  readonly step: number;
  readonly input: unknown;
  readonly output?: unknown;
  readonly lifecycle: TransitionLifecycle;
  readonly failure?: { readonly code: string; readonly message: string };
  /** Snapshot reading AFTER this transition, when the substrate advertises snapshot. */
  readonly reading?: Readonly<Record<string, number>>;
  readonly evidenceIds: readonly string[];
}

export interface RecordedRun {
  readonly substrate: string;
  readonly contractId: string;
  readonly executionKind: DynamicsExecutionKind;
  readonly capabilities: DynamicsCapabilities;
  readonly determinism: DeterminismDeclaration;
  readonly transitions: readonly RecordedTransition[];
  readonly stateFacts: readonly StateFact[];
  readonly conformance: ConformanceReport;
  /** Present only when the substrate can declare its law; absent is meaningful, not missing. */
  readonly transitionLaw?: unknown;
  readonly terminated: boolean;
}

/** One projection applied to one snapshot, with the Ω_sys it produced. Both from runtime calls. */
export interface RecordedProjection {
  readonly definitionId: string;
  readonly scope: string;
  readonly result: ProjectionResult;
  readonly opportunities: readonly OpportunityResult[];
  readonly evidenceIds: readonly string[];
}

/** Episode detection at ONE parameterization. Multiple are kept; none overwrites another. */
export interface RecordedDetection {
  readonly label: string;
  readonly contract: DetectionContract;
  readonly result: DetectionResult;
  readonly evidenceId: string;
}

export interface ObservatoryRegistries {
  readonly corpus: readonly CorpusEntry[];
  readonly corpusLedger: CorpusLedger;
  readonly discoveries: readonly Discovery[];
  readonly predictions: readonly Prediction[];
  readonly predictionAccuracy: PredictionAccuracy;
  readonly negativeResults: readonly NegativeResult[];
  readonly negativeLedger: NegativeLedger;
  readonly projectionClaims: readonly ProjectionClaim[];
  readonly projectionProfile: EvidenceProfile;
}

export interface BundleRevision {
  /** Commit the bundle was captured at. Supplied by the emitter; the runtime does not read git. */
  readonly commit: string;
  readonly coreVersion: string;
  readonly bundleSchema: string;
}

export interface ObservatoryBundle {
  readonly revision: BundleRevision;
  readonly registries: ObservatoryRegistries;
  readonly runs: readonly RecordedRun[];
  readonly projections: readonly RecordedProjection[];
  readonly detections: readonly RecordedDetection[];
  readonly ablations: readonly AblationRecord[];
  /** Flat evidence DAG. Every id referenced anywhere in the bundle resolves here. */
  readonly evidence: readonly EvidenceNode[];
  /** Substrates in the corpus with no captured run — shown as pending, never fabricated. */
  readonly pendingSubstrates: readonly string[];
}

export const BUNDLE_SCHEMA = 'observatory-bundle/1';

/** Flattens a contract's evidence channel into log nodes. Pure re-expression; nothing is computed. */
export function evidenceNodesFrom(
  evidence: DynamicsEvidence,
  step: number,
  prefix: string,
  origin: string,
): EvidenceNode[] {
  const nodes: EvidenceNode[] = [];
  evidence.declaredInputs.forEach((r, i) => {
    nodes.push({ id: `${prefix}:in:${i}`, kind: 'raw-event', origin, label: `input ${r.kind}`, step, payload: r, derivedFrom: [] });
  });
  evidence.substrateResponses.forEach((r, i) => {
    nodes.push({
      id: `${prefix}:out:${i}`,
      kind: 'adapter-output',
      origin,
      label: `response ${r.kind}`,
      step,
      payload: r,
      derivedFrom: evidence.declaredInputs.map((_, j) => `${prefix}:in:${j}`),
    });
  });
  evidence.executionTrace.forEach((t, i) => {
    nodes.push({
      id: `${prefix}:trace:${i}`,
      kind: 'runtime-derivation',
      origin,
      label: t.summary,
      step,
      payload: t,
      derivedFrom: evidence.substrateResponses.map((_, j) => `${prefix}:out:${j}`),
    });
  });
  evidence.unresolvedInterpretations.forEach((o, i) => {
    nodes.push({
      id: `${prefix}:obligation:${i}`,
      kind: 'runtime-derivation',
      origin,
      label: `unresolved: ${o.claim}`,
      step,
      payload: o,
      derivedFrom: [],
    });
  });
  return nodes;
}
