/**
 * DynamicsContract (F1.3) — the abstraction for lawful evolution: the plane-neutral execution boundary
 * between a declared world and an execution substrate. The kernel executes a contract; it never
 * understands the dynamics behind it, and asserts nothing about unobserved internal laws.
 *
 *     World  →  DynamicsContract  →  ExecutionSubstrate (FieldRuntime is one, executionKind 'opaque-native')
 *
 * There is deliberately NO `declarative: boolean` — that would collapse independent properties into one
 * flag. `executionKind`, `capabilities`, and `determinism` carry those claims separately. EXPERIMENTAL,
 * field-free (enforced by `world/architecture.test.ts`).
 */
import type { WorldStateSnapshot } from './world.ts';

export interface DynamicsIdentity {
  readonly id: string;
  readonly version: string;
}

/** Closed for the current stage. `FieldRuntime` declares `opaque-native`. */
export type DynamicsExecutionKind =
  | 'declarative'
  | 'interpreted'
  | 'compiled'
  | 'opaque-native'
  | 'external'
  | 'nondeterministic'
  | 'hybrid';

/** Explicit, conservative. A lossy snapshot must NOT imply restore or replay. */
export interface DynamicsCapabilities {
  readonly initialize: boolean;
  readonly advance: true;
  readonly snapshot: boolean;
  readonly restore: boolean;
  readonly replay: boolean;
  readonly inspectInternalState: boolean;
  readonly declareTransitionLaw: boolean;
  readonly deterministicReplay: boolean;
}

export type DeterminismClassification =
  | 'deterministic'
  | 'conditionally-deterministic'
  | 'nondeterministic'
  | 'unknown';

export interface DeterminismDeclaration {
  readonly classification: DeterminismClassification;
  readonly controlledInputs: readonly string[];
  readonly uncontrolledInputs: readonly string[];
  readonly requirements: readonly string[];
}

export interface EvidenceSource {
  readonly kind: string;
  readonly id: string;
}

/** No evidence entry may exist without source identity. */
export interface EvidenceRecord {
  readonly id: string;
  readonly kind: string;
  readonly source: EvidenceSource;
  readonly observedAt: string | number;
  readonly payload: unknown;
}

export interface InvariantEvidence {
  readonly id: string;
  readonly held: boolean;
  readonly detail: string;
  readonly source: EvidenceSource;
}

export interface TransitionEvidence {
  readonly id: string;
  readonly step: number;
  readonly source: EvidenceSource;
  readonly summary: string;
}

/**
 * An interpretation the runtime does NOT assert. It records that the claim is unresolved and which
 * authority may discharge it — never that it is established.
 */
export interface InterpretationObligation {
  readonly id: string;
  readonly claim: string;
  readonly authority: string;
  readonly status: 'unresolved';
}

export interface DynamicsEvidence {
  readonly declaredInputs: readonly EvidenceRecord[];
  readonly substrateResponses: readonly EvidenceRecord[];
  readonly checkedInvariants: readonly InvariantEvidence[];
  readonly executionTrace: readonly TransitionEvidence[];
  readonly unresolvedInterpretations: readonly InterpretationObligation[];
}

export type DynamicsFailureCode =
  | 'invalid-declaration'
  | 'invalid-state'
  | 'unsupported-operation'
  | 'capability-unavailable'
  | 'substrate-failure'
  | 'invariant-violation'
  | 'version-incompatible'
  | 'nondeterministic-result'
  | 'snapshot-unsupported'
  | 'restore-unsupported';

export interface DynamicsFailure {
  readonly code: DynamicsFailureCode;
  readonly message: string;
  /** The original cause is retained internally; it is NOT a substrate-specific type on the generic surface. */
  readonly cause?: unknown;
}

/** Typed results, not routine exceptions. Exceptions stay reserved for programmer errors. */
export type DynamicsResult<T, Evidence> =
  | { readonly ok: true; readonly value: T; readonly evidence: Evidence }
  | { readonly ok: false; readonly error: DynamicsFailure; readonly evidence: Evidence };

/**
 * Whether further transitions are defined from the resulting state (corpus finding C1).
 *
 * Added because the corpus introduced the first substrates that FINISH. The field and the governor run
 * indefinitely, so no earlier substrate could reveal that a kernel driving a contract has no generic way
 * to learn it should stop calling `advance`. Without this, a kernel must read substrate-specific output
 * to decide whether to continue — which is exactly the abstraction leak the contract exists to prevent.
 *
 * Deliberately minimal: `terminal` does NOT distinguish "finished with a result" from "finished without
 * one" (goal-reached vs exhausted). Both corpus substrates exhibit that distinction, but the evidence
 * only forces "must the kernel keep going?", so the richer split stays in substrate-specific output
 * until a third substrate needs it generically.
 */
export type TransitionLifecycle = 'continuing' | 'terminal';

export interface Transition<State, Output> {
  readonly state: State;
  readonly output: Output;
  /** Absent is read as `continuing` — the behaviour of every substrate that predates this concept. */
  readonly lifecycle?: TransitionLifecycle;
}

export interface TransitionLawRule {
  readonly [key: string]: number | string | boolean;
}

/**
 * A substrate's declared transition law, expressed as DATA (G3.3 refinement).
 *
 * Added because the second substrate exposed a gap: `capabilities.declareTransitionLaw` could be set
 * truthfully, yet the contract offered no way to obtain the law. An `opaque-native` substrate cannot
 * provide one (and must leave the capability false); a substrate whose law IS a declared table can.
 */
export interface TransitionLawDescription {
  readonly kind: string;
  readonly rules: readonly TransitionLawRule[];
  readonly notes?: string;
}

export interface DynamicsSnapshot {
  /** The generic readable projection the kernel may inspect (e.g. to check invariants). */
  readonly reading: WorldStateSnapshot;
  /** Whether this snapshot can reconstruct `State`. A lossy substrate sets false. */
  readonly restorable: boolean;
  /** Substrate-specific serialization — present ONLY when `restorable`. */
  readonly payload?: unknown;
}

export interface InitializeRequest {
  readonly declaration: unknown;
}

export interface DynamicsExecutionContext {
  readonly step: number;
  readonly now?: number;
}

export interface DynamicsContract<State, Input, Output, Evidence = DynamicsEvidence> {
  readonly identity: DynamicsIdentity;
  readonly executionKind: DynamicsExecutionKind;
  readonly capabilities: DynamicsCapabilities;
  readonly determinism: DeterminismDeclaration;

  initialize(request: InitializeRequest): DynamicsResult<State, Evidence>;
  advance(state: State, input: Input, context: DynamicsExecutionContext): DynamicsResult<Transition<State, Output>, Evidence>;
  snapshot?(state: State, context: DynamicsExecutionContext): DynamicsResult<DynamicsSnapshot, Evidence>;
  restore?(snapshot: DynamicsSnapshot, context: DynamicsExecutionContext): DynamicsResult<State, Evidence>;
  /** Present iff `capabilities.declareTransitionLaw` is true. Returns the law as data. */
  describeTransitionLaw?(): DynamicsResult<TransitionLawDescription, Evidence>;
}

export interface DynamicsContractProblem {
  readonly rule: string;
  readonly detail: string;
}

/**
 * Static consistency check over a contract's declarations. Rejects contradictory capability /
 * execution-kind / determinism combinations (F1.3 negative tests).
 */
export function validateDynamicsContract(
  c: Pick<DynamicsContract<unknown, unknown, unknown, unknown>, 'executionKind' | 'capabilities' | 'determinism' | 'describeTransitionLaw'>,
): DynamicsContractProblem[] {
  const problems: DynamicsContractProblem[] = [];
  const caps = c.capabilities;
  if (caps.deterministicReplay && !caps.replay) {
    problems.push({ rule: 'deterministicReplay⇒replay', detail: 'deterministicReplay:true requires replay:true' });
  }
  if (caps.restore && !caps.snapshot) {
    problems.push({ rule: 'restore⇒snapshot', detail: 'restore:true requires snapshot:true' });
  }
  if (caps.declareTransitionLaw && c.executionKind === 'opaque-native') {
    problems.push({ rule: 'law∦opaque-native', detail: 'declareTransitionLaw:true is incompatible with executionKind opaque-native' });
  }
  if (c.determinism.classification === 'deterministic' && c.determinism.uncontrolledInputs.length > 0) {
    problems.push({ rule: 'deterministic∦uncontrolled', detail: 'classification deterministic must not list uncontrolled inputs' });
  }
  // G3.3 refinement: the capability must be exercisable, and must not be claimed silently.
  const hasLaw = typeof c.describeTransitionLaw === 'function';
  if (caps.declareTransitionLaw && !hasLaw) {
    problems.push({ rule: 'declareTransitionLaw⇒describeTransitionLaw', detail: 'declareTransitionLaw:true requires a describeTransitionLaw() method' });
  }
  if (!caps.declareTransitionLaw && hasLaw) {
    problems.push({ rule: 'describeTransitionLaw⇒declareTransitionLaw', detail: 'describeTransitionLaw() present but declareTransitionLaw is false' });
  }
  return problems;
}
