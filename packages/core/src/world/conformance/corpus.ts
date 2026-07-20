/**
 * Substrate conformance corpus (EXPERIMENTAL, internal).
 *
 * The corpus answers one measured question, pre-registered in
 * `docs/planning/world-substrate/substrate-conformance-corpus.md`:
 *
 *     How little does DynamicsContract change as independently-written substrates are adapted to it?
 *
 * Two pieces live here: a **churn ledger** (what each substrate cost the contract, and whether the cost
 * was a missing general concept or a rejected convenience) and a **substrate-agnostic conformance
 * battery** that exercises any contract through the generic surface only — if the battery ever needs to
 * know which substrate it is driving, the abstraction has failed.
 */
import { hostWorld } from '../kernel.ts';
import { validateDynamicsContract } from '../dynamics.ts';
import type { DynamicsContract, DynamicsExecutionKind } from '../dynamics.ts';
import type { World } from '../world.ts';

// ------------------------------------------------------------------------------- churn accounting

export type ChurnClass =
  | 'required-member'
  | 'optional-member'
  | 'union-variant'
  | 'consistency-rule'
  | 'changed-semantics';

/** Weights fixed by the pre-registration; not tunable after the fact. */
export const CHURN_WEIGHTS: Readonly<Record<ChurnClass, number>> = {
  'required-member': 3,
  'optional-member': 1,
  'union-variant': 1,
  'consistency-rule': 1,
  'changed-semantics': 3,
};

/**
 * Three kinds of refinement, not two. The earlier binary silently folded `representational` into
 * whichever neighbour was convenient, which is exactly the ambiguity that lets a contract drift.
 *
 *   structural       - the contract LACKED a concept (D-001 accessor, D-002 lifecycle)
 *   representational - the concept existed; this expresses it better. Allowed, but not a discovery
 *   convenience      - makes adaptation easier, adds no explanatory power. NEVER accepted.
 */
export type ChangeClassification = 'structural' | 'representational' | 'convenience';

export interface ContractChange {
  readonly member: string;
  readonly churnClass: ChurnClass;
  readonly classification: ChangeClassification;
  readonly rationale: string;
}

/** A change that was considered and REJECTED — recorded so the rejection is auditable. */
export interface RejectedChange {
  readonly member: string;
  readonly classification: 'convenience';
  readonly rationale: string;
}

export type CorpusStatus = 'adapted' | 'pending';

export type CorpusOutcome =
  | 'generalized'
  | 'generalized-with-refinement'
  | 'field-fitted'
  | 'inconclusive'
  | 'not-yet-run';

export interface CorpusEntry {
  readonly substrate: string;
  readonly role: string;
  readonly status: CorpusStatus;
  readonly executionKind?: DynamicsExecutionKind;
  readonly outcome: CorpusOutcome;
  /** Churn predicted BEFORE adapting (pre-registration). */
  readonly predictedChurn?: number;
  readonly changes: readonly ContractChange[];
  readonly rejectedChanges: readonly RejectedChange[];
  readonly note?: string;
}

export function churnOf(changes: readonly ContractChange[]): number {
  return changes.reduce((sum, c) => sum + CHURN_WEIGHTS[c.churnClass], 0);
}

/**
 * The corpus as it actually stands. Adapted entries record what each substrate cost; pending entries
 * record what is not yet evidence. `pending` rows must never be read as support for generality.
 */
export function corpus(): CorpusEntry[] {
  return [
    {
      substrate: 'FieldRuntime',
      role: 'continuous, opaque, non-terminating',
      status: 'adapted',
      executionKind: 'opaque-native',
      outcome: 'generalized-with-refinement',
      changes: [],
      rejectedChanges: [],
      note: 'the substrate the contract was extracted from; establishes nothing about generality on its own',
    },
    {
      substrate: 'QualityGovernor',
      role: 'discrete thresholds, declared law, non-terminating',
      status: 'adapted',
      executionKind: 'interpreted',
      outcome: 'generalized-with-refinement',
      changes: [
        {
          member: 'describeTransitionLaw()',
          churnClass: 'optional-member',
          classification: 'structural',
          rationale: 'declareTransitionLaw could be claimed truthfully with no way to obtain the law — a capability that cannot be exercised is incoherent',
        },
        {
          member: 'declareTransitionLaw ⇔ describeTransitionLaw',
          churnClass: 'consistency-rule',
          classification: 'structural',
          rationale: 'the capability and the accessor must agree in both directions',
        },
      ],
      rejectedChanges: [],
    },
    {
      substrate: 'FiniteStateMachine',
      role: 'control — expected to require zero change',
      status: 'adapted',
      executionKind: 'declarative',
      outcome: 'generalized-with-refinement',
      predictedChurn: 0,
      changes: [
        {
          member: 'Transition.lifecycle',
          churnClass: 'optional-member',
          classification: 'structural',
          rationale: 'accepting states finish; without a generic terminal signal a kernel must read substrate-specific output to know whether to keep advancing',
        },
      ],
      rejectedChanges: [],
      note: 'PREDICTION FALSIFIED (predicted 0, actual 1). The control exposing the gap is the stronger result: termination is general, not search-specific.',
    },
    {
      substrate: 'SearchPlanner',
      role: 'falsification candidate — terminates, partially declarable law',
      status: 'adapted',
      executionKind: 'hybrid',
      outcome: 'generalized',
      predictedChurn: 1,
      changes: [], // the FSM had already paid for termination
      rejectedChanges: [
        {
          member: 'TransitionLawDescription.completeness',
          classification: 'convenience',
          rationale: 'declareTransitionLaw:false already answers truthfully — this substrate cannot declare THE law; publishing part of it is a feature request, not a missing concept',
        },
      ],
      note: 'first substrate to exercise executionKind "hybrid", declared in F1.3 but never used until now',
    },
    { substrate: 'EventSourcedAggregate', role: 'replay-semantics probe', status: 'pending', outcome: 'not-yet-run', predictedChurn: 0, changes: [], rejectedChanges: [] },
    { substrate: 'WorkflowEngine', role: 'external/async effects', status: 'pending', outcome: 'not-yet-run', changes: [], rejectedChanges: [] },
    { substrate: 'RuleEngine', role: 'declarative law, conflict resolution', status: 'pending', outcome: 'not-yet-run', changes: [], rejectedChanges: [] },
    { substrate: 'GameTurnSystem', role: 'multi-participant turn order', status: 'pending', outcome: 'not-yet-run', changes: [], rejectedChanges: [] },
  ];
}

export interface CorpusLedger {
  readonly adapted: number;
  readonly pending: number;
  readonly totalChurn: number;
  readonly churnBySubstrate: readonly { readonly substrate: string; readonly churn: number; readonly predicted?: number }[];
  readonly executionKindsExercised: readonly DynamicsExecutionKind[];
  /** True only when the MOST RECENTLY adapted substrate cost nothing — never an average. */
  readonly convergingOnLastAdapted: boolean;
  readonly structuralAccepted: number;
  readonly representationalAccepted: number;
  /** Must always be 0. A convenience is a rejection, not a justification. */
  readonly conveniencesAccepted: number;
  /**
   * Only rejections that were WRITTEN DOWN. Rejections made while writing an adapter and never
   * recorded are not counted - the number is a floor, not a total.
   */
  readonly conveniencesRejected: number;
}

export function corpusLedger(): CorpusLedger {
  const entries = corpus();
  const adapted = entries.filter((e) => e.status === 'adapted');
  const last = adapted[adapted.length - 1];
  return {
    adapted: adapted.length,
    pending: entries.length - adapted.length,
    totalChurn: adapted.reduce((sum, e) => sum + churnOf(e.changes), 0),
    churnBySubstrate: adapted.map((e) => ({ substrate: e.substrate, churn: churnOf(e.changes), ...(e.predictedChurn !== undefined ? { predicted: e.predictedChurn } : {}) })),
    executionKindsExercised: [...new Set(adapted.map((e) => e.executionKind).filter((k): k is DynamicsExecutionKind => k !== undefined))],
    convergingOnLastAdapted: last !== undefined && churnOf(last.changes) === 0,
    structuralAccepted: adapted.reduce((n, e) => n + e.changes.filter((c) => c.classification === 'structural').length, 0),
    representationalAccepted: adapted.reduce((n, e) => n + e.changes.filter((c) => c.classification === 'representational').length, 0),
    conveniencesAccepted: adapted.reduce((n, e) => n + e.changes.filter((c) => c.classification === 'convenience').length, 0),
    conveniencesRejected: adapted.reduce((n, e) => n + e.rejectedChanges.length, 0),
  };
}

// -------------------------------------------------------------------------- conformance battery

export interface ConformanceFinding {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ConformanceReport {
  readonly contract: string;
  readonly executionKind: DynamicsExecutionKind;
  readonly findings: readonly ConformanceFinding[];
  readonly conformant: boolean;
  readonly terminated: boolean;
  readonly transitions: number;
}

function finding(check: string, passed: boolean, detail: string): ConformanceFinding {
  return { check, passed, detail };
}

/**
 * Drive any contract through the GENERIC surface only and report what it does. Deliberately knows
 * nothing about any substrate: it reads capabilities and behaves accordingly, so a substrate cannot
 * pass by being recognized.
 */
export function runConformance<S, I, O>(
  makeWorld: () => World,
  makeContract: (w: World) => DynamicsContract<S, I, O>,
  inputs: readonly I[],
): ConformanceReport {
  const findings: ConformanceFinding[] = [];
  const world = makeWorld();
  const contract = makeContract(world);

  const problems = validateDynamicsContract(contract);
  findings.push(finding('declarations self-consistent', problems.length === 0, problems.map((p) => p.rule).join(', ') || 'no problems'));

  const host = hostWorld(world, contract);
  let transitions = 0;
  let terminated = false;
  let lifecycleSeen = false;

  for (const input of inputs) {
    const r = host.advance(input);
    if (!r.ok) {
      findings.push(finding('advance succeeded', false, `failed at ${transitions}: ${r.error.code}`));
      break;
    }
    transitions++;
    if (host.lastLifecycle === 'terminal') { terminated = true; lifecycleSeen = true; break; }
  }
  findings.push(finding('advance succeeded', true, `${transitions} transition(s)`));

  // terminal substrates must be IDEMPOTENT: asking again is neither progress nor an error
  if (terminated) {
    const again = host.advance(inputs[inputs.length - 1]!);
    findings.push(finding(
      'terminal is idempotent',
      again.ok && host.lastLifecycle === 'terminal',
      again.ok ? `still ${host.lastLifecycle}` : `errored: ${again.error.code}`,
    ));
  }

  // snapshot / restore, driven purely by declared capability
  if (contract.capabilities.snapshot) {
    const snap = host.readState();
    findings.push(finding('snapshot available', snap.ok, snap.ok ? `restorable=${snap.value.restorable}` : 'failed'));
    if (snap.ok && contract.capabilities.restore) {
      const restored = contract.restore!(snap.value, { step: 0 });
      findings.push(finding('restore round-trips', restored.ok, restored.ok ? 'state reconstructed' : 'restore failed'));
      findings.push(finding(
        'restore matches snapshot claim',
        snap.value.restorable === true,
        'a restorable capability requires a restorable snapshot',
      ));
    }
  }

  // determinism: a contract declaring `deterministic` must produce identical readings twice
  if (contract.determinism.classification === 'deterministic') {
    const w2 = makeWorld();
    const h2 = hostWorld(w2, makeContract(w2));
    for (const input of inputs.slice(0, transitions)) h2.advance(input);
    const a = host.readState();
    const b = h2.readState();
    const same = a.ok && b.ok && JSON.stringify(a.value.reading.metrics) === JSON.stringify(b.value.reading.metrics);
    findings.push(finding('declared determinism holds', same, same ? 'identical readings' : 'readings diverged'));
  }

  if (contract.capabilities.declareTransitionLaw) {
    const law = contract.describeTransitionLaw!();
    findings.push(finding('declared law retrievable', law.ok, law.ok ? `${law.value.rules.length} rule(s)` : 'failed'));
  }

  host.dispose();

  return {
    contract: contract.identity.id,
    executionKind: contract.executionKind,
    findings,
    conformant: findings.every((f) => f.passed),
    terminated: terminated || lifecycleSeen,
    transitions,
  };
}
