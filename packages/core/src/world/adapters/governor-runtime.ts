/**
 * G3.1 — second-substrate adapter: the quality-governor rule set behind `DynamicsContract`.
 *
 * The contract was NOT changed to make this substrate fit. Everything is declared truthfully, and the
 * declarations differ sharply from the field adapter — which is the point of the experiment:
 *
 *   field      → opaque-native · conditionally-deterministic · snapshot-only (lossy, non-restorable)
 *   governor   → interpreted   · deterministic               · snapshot + restore + replay (complete)
 *
 * The generic `World` never holds a substrate instance; the kernel threads opaque `State`. Native error
 * causes are retained INTERNALLY on `DynamicsFailure.cause` (typed `unknown`) and never leak a native
 * type into `World`. Internal/experimental; not exported from the package entry.
 */
import { createWorldEnvelope } from '../envelope.ts';
import type { WorldVersionEnvelope } from '../envelope.ts';
import type { World, WorldStateSnapshot } from '../world.ts';
import type {
  DynamicsContract,
  DynamicsEvidence,
  DynamicsExecutionContext,
  DynamicsResult,
  DynamicsSnapshot,
  EvidenceRecord,
  Transition,
  TransitionLawDescription,
  TransitionLawRule,
} from '../dynamics.ts';
import {
  ESCALATE_RULES,
  RECOVER_STREAK,
  DEFAULT_BUDGET_MS,
  feedGovernor,
  initialGovernorState,
  isGovernorState,
} from '../substrates/governor.ts';
import type { GovernorState, QualityTier } from '../substrates/governor.ts';

export interface GovernorSubstrateState {
  readonly governor: GovernorState;
  readonly envelope: WorldVersionEnvelope;
  readonly step: number;
}

export interface GovernorAdvanceInput {
  readonly durationMs: number;
}

export interface GovernorAdvanceOutput {
  readonly tier: QualityTier;
  readonly changed: boolean;
}

const SOURCE = { kind: 'substrate', id: 'quality-governor' } as const;

function record(id: string, kind: string, observedAt: number, payload: unknown): EvidenceRecord {
  return { id, kind, source: SOURCE, observedAt, payload };
}

function evidence(parts: Partial<DynamicsEvidence>): DynamicsEvidence {
  return {
    declaredInputs: parts.declaredInputs ?? [],
    substrateResponses: parts.substrateResponses ?? [],
    checkedInvariants: parts.checkedInvariants ?? [],
    executionTrace: parts.executionTrace ?? [],
    unresolvedInterpretations: parts.unresolvedInterpretations ?? [],
  };
}

function reading(state: GovernorSubstrateState): WorldStateSnapshot {
  return {
    envelope: state.envelope,
    step: state.step,
    entities: [
      {
        id: 'governor',
        metrics: {
          tier: state.governor.tier,
          overrunStreak: state.governor.overrunStreak,
          cleanStreak: state.governor.cleanStreak,
        },
      },
    ],
    metrics: {
      tier: state.governor.tier,
      overrunStreak: state.governor.overrunStreak,
      cleanStreak: state.governor.cleanStreak,
      budgetMs: state.governor.budgetMs,
    },
  };
}

/**
 * A `DynamicsContract` over the governor rule set. `executionKind: 'interpreted'` — the transition law
 * is a DECLARED TABLE (`ESCALATE_RULES` + `RECOVER_STREAK`) interpreted per input, so unlike the field
 * substrate this one may honestly set `declareTransitionLaw: true` and `inspectInternalState: true`.
 */
export function governorDynamics(
  world: World,
  budgetMs: number = DEFAULT_BUDGET_MS,
): DynamicsContract<GovernorSubstrateState, GovernorAdvanceInput, GovernorAdvanceOutput> {
  return {
    identity: { id: `quality-governor:${world.envelope.worldInstance}`, version: '0.1.0' },
    executionKind: 'interpreted',
    capabilities: {
      initialize: true,
      advance: true,
      snapshot: true,
      restore: true, // state is plain data — a snapshot fully reconstructs it
      replay: true,
      inspectInternalState: true, // streak counters are surfaced, not hidden
      declareTransitionLaw: true, // the escalation table IS the law
      deterministicReplay: true,
    },
    determinism: {
      classification: 'deterministic',
      controlledInputs: ['frame-duration-sequence', 'budgetMs'],
      uncontrolledInputs: [], // no clock, no RNG, no host geometry
      requirements: ['identical input sequence', 'identical initial state'],
    },

    initialize(request): DynamicsResult<GovernorSubstrateState, DynamicsEvidence> {
      const declared = request.declaration as World;
      const state: GovernorSubstrateState = {
        governor: initialGovernorState(budgetMs),
        envelope: declared?.envelope ?? createWorldEnvelope('governor-world'),
        step: 0,
      };
      return {
        ok: true,
        value: state,
        evidence: evidence({
          declaredInputs: [record('init', 'declaration', 0, { budgetMs, rules: ESCALATE_RULES.length, recoverStreak: RECOVER_STREAK })],
        }),
      };
    },

    advance(state, input, context): DynamicsResult<Transition<GovernorSubstrateState, GovernorAdvanceOutput>, DynamicsEvidence> {
      const duration = input.durationMs;
      if (!Number.isFinite(duration) || duration < 0) {
        // native cause retained internally; no native type leaks onto the generic surface
        return {
          ok: false,
          error: {
            code: 'invalid-state',
            message: `governor: frame duration must be a finite, non-negative number (got ${String(duration)})`,
            cause: { received: duration, expected: 'finite >= 0' },
          },
          evidence: evidence({ declaredInputs: [record('advance-input', 'duration', context.step, { durationMs: duration })] }),
        };
      }

      const stepResult = feedGovernor(state.governor, duration);
      const nextStep = state.step + 1;
      const next: GovernorSubstrateState = { governor: stepResult.state, envelope: state.envelope, step: nextStep };

      return {
        ok: true,
        value: { state: next, output: { tier: stepResult.state.tier, changed: stepResult.changed !== undefined } },
        evidence: evidence({
          declaredInputs: [record('advance-input', 'duration', context.step, { durationMs: duration })],
          substrateResponses: [record('advance-response', 'tier', nextStep, { tier: stepResult.state.tier, changed: stepResult.changed })],
          executionTrace: [
            {
              id: `g-${nextStep}`,
              step: nextStep,
              source: SOURCE,
              summary: `duration=${duration} → tier ${stepResult.state.tier}` + (stepResult.changed !== undefined ? ' (changed)' : ''),
            },
          ],
          unresolvedInterpretations: [
            // the runtime reports a tier; it must NOT assert what a participant perceives
            { id: 'perceived-quality', claim: 'tier interpreted as participant-perceived quality', authority: 'empirical', status: 'unresolved' },
          ],
        }),
      };
    },

    snapshot(state, _context): DynamicsResult<DynamicsSnapshot, DynamicsEvidence> {
      return {
        ok: true,
        value: {
          reading: reading(state),
          restorable: true, // complete — the payload reconstructs State exactly
          payload: { ...state.governor },
        },
        evidence: evidence({ substrateResponses: [record('snapshot', 'governor-state', state.step, { tier: state.governor.tier })] }),
      };
    },

    restore(snapshot, _context): DynamicsResult<GovernorSubstrateState, DynamicsEvidence> {
      if (!snapshot.restorable || !isGovernorState(snapshot.payload)) {
        return {
          ok: false,
          error: {
            code: 'invalid-state',
            message: 'governor: snapshot payload is not a governor state (cannot restore)',
            cause: { restorable: snapshot.restorable },
          },
          evidence: evidence({ substrateResponses: [record('restore', 'rejected', snapshot.reading.step, { restorable: snapshot.restorable })] }),
        };
      }
      const restored: GovernorSubstrateState = {
        governor: snapshot.payload,
        envelope: snapshot.reading.envelope,
        step: snapshot.reading.step,
      };
      return {
        ok: true,
        value: restored,
        evidence: evidence({ substrateResponses: [record('restore', 'governor-state', restored.step, { tier: restored.governor.tier })] }),
      };
    },

    /**
     * G3.3 refinement. Present because `declareTransitionLaw` is true: the law IS data, so it can be
     * returned as data. The field adapter has no counterpart — it declares the capability false.
     */
    describeTransitionLaw(): DynamicsResult<TransitionLawDescription, DynamicsEvidence> {
      const rules: TransitionLawRule[] = [
        ...ESCALATE_RULES.map((r) => ({ kind: 'escalate', aboveMs: r.aboveMs, streak: r.streak, tier: r.tier })),
        { kind: 'recover', cleanStreak: RECOVER_STREAK, tierDelta: -1 },
        { kind: 'overrun-test', factor: 1.3, budgetMs },
      ];
      return {
        ok: true,
        value: {
          kind: 'threshold-table',
          rules,
          notes: 'first matching escalate rule wins; recovery drops exactly one tier (asymmetric hysteresis)',
        },
        evidence: evidence({ substrateResponses: [record('describe-law', 'transition-law', 0, { ruleCount: rules.length })] }),
      };
    },
  };
}
