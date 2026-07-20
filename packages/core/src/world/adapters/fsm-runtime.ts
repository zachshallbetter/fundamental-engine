/**
 * Corpus adapter: the finite state machine behind `DynamicsContract` (EXPERIMENTAL, internal).
 *
 * The FSM is the corpus **control** — the most contract-shaped substrate imaginable. It was
 * pre-registered as expected to require **zero** contract change.
 *
 * That prediction was FALSIFIED, and the falsification is the point: an FSM has accepting states, so it
 * is the first corpus substrate that FINISHES, and the contract had no generic way to say so. See
 * `TransitionLifecycle` in `../dynamics.ts`. Everything else adapted unchanged.
 *
 * `executionKind: 'declarative'` — the entire law, guards included, is data with no computed part. This
 * is the first substrate to exercise that variant (the field is `opaque-native`, the governor
 * `interpreted`).
 */
import { createWorldEnvelope } from '../envelope.ts';
import type { WorldVersionEnvelope } from '../envelope.ts';
import type { World, WorldStateSnapshot } from '../world.ts';
import type {
  DynamicsContract,
  DynamicsEvidence,
  DynamicsResult,
  DynamicsSnapshot,
  EvidenceRecord,
  Transition,
  TransitionLawDescription,
  TransitionLawRule,
} from '../dynamics.ts';
import { fireFsm, initialFsmState, isAccepting, isFsmState } from '../substrates/fsm.ts';
import type { FsmDefinition, FsmOutcome, FsmState } from '../substrates/fsm.ts';

export interface FsmSubstrateState {
  readonly fsm: FsmState;
  readonly envelope: WorldVersionEnvelope;
  readonly step: number;
}

export interface FsmAdvanceInput {
  readonly event: string;
}

export interface FsmAdvanceOutput {
  readonly state: string;
  readonly outcome: FsmOutcome;
}

const SOURCE = { kind: 'substrate', id: 'finite-state-machine' } as const;

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

/** Numeric-only, per `WorldStateSnapshot`; the symbolic state rides on the entity id. */
function reading(def: FsmDefinition, state: FsmSubstrateState): WorldStateSnapshot {
  const index = def.states.indexOf(state.fsm.current);
  return {
    envelope: state.envelope,
    step: state.step,
    entities: [{ id: `fsm:${state.fsm.current}`, metrics: { stateIndex: index, steps: state.fsm.steps } }],
    metrics: {
      stateIndex: index,
      steps: state.fsm.steps,
      accepting: isAccepting(def, state.fsm) ? 1 : 0,
    },
  };
}

export function fsmDynamics(
  world: World,
  def: FsmDefinition,
): DynamicsContract<FsmSubstrateState, FsmAdvanceInput, FsmAdvanceOutput> {
  return {
    identity: { id: `fsm:${def.id}:${world.envelope.worldInstance}`, version: '0.1.0' },
    executionKind: 'declarative',
    capabilities: {
      initialize: true,
      advance: true,
      snapshot: true,
      restore: true,
      replay: true,
      inspectInternalState: true,
      declareTransitionLaw: true, // the table IS the whole law
      deterministicReplay: true,
    },
    determinism: {
      classification: 'deterministic',
      controlledInputs: ['event-sequence', 'initial-context'],
      uncontrolledInputs: [],
      requirements: ['identical event sequence', 'identical initial context'],
    },

    initialize(request): DynamicsResult<FsmSubstrateState, DynamicsEvidence> {
      const declared = request.declaration as World;
      return {
        ok: true,
        value: {
          fsm: initialFsmState(def),
          envelope: declared?.envelope ?? createWorldEnvelope('fsm-world'),
          step: 0,
        },
        evidence: evidence({
          declaredInputs: [record('init', 'declaration', 0, { id: def.id, states: def.states.length, transitions: def.transitions.length })],
        }),
      };
    },

    advance(state, input, context): DynamicsResult<Transition<FsmSubstrateState, FsmAdvanceOutput>, DynamicsEvidence> {
      if (typeof input.event !== 'string' || input.event.length === 0) {
        return {
          ok: false,
          error: { code: 'invalid-state', message: 'fsm: event must be a non-empty string', cause: { received: input.event } },
          evidence: evidence({ declaredInputs: [record('advance-input', 'event', context.step, input)] }),
        };
      }

      const fired = fireFsm(def, state.fsm, input.event);
      const nextStep = state.step + 1;
      const next: FsmSubstrateState = { fsm: fired.state, envelope: state.envelope, step: nextStep };
      // the falsifying case: an accepting state has no further defined transitions
      const lifecycle = isAccepting(def, fired.state) ? ('terminal' as const) : ('continuing' as const);

      return {
        ok: true,
        value: {
          state: next,
          output: { state: fired.state.current, outcome: fired.outcome },
          lifecycle,
        },
        evidence: evidence({
          declaredInputs: [record('advance-input', 'event', context.step, input)],
          substrateResponses: [record('advance-response', 'outcome', nextStep, { outcome: fired.outcome, to: fired.state.current })],
          executionTrace: [
            {
              id: `f-${nextStep}`,
              step: nextStep,
              source: SOURCE,
              summary: `${input.event} → ${fired.outcome} (${fired.state.current})`,
            },
          ],
        }),
      };
    },

    snapshot(state, _context): DynamicsResult<DynamicsSnapshot, DynamicsEvidence> {
      return {
        ok: true,
        value: { reading: reading(def, state), restorable: true, payload: { ...state.fsm } },
        evidence: evidence({ substrateResponses: [record('snapshot', 'fsm-state', state.step, { current: state.fsm.current })] }),
      };
    },

    restore(snapshot, _context): DynamicsResult<FsmSubstrateState, DynamicsEvidence> {
      if (!snapshot.restorable || !isFsmState(snapshot.payload)) {
        return {
          ok: false,
          error: { code: 'invalid-state', message: 'fsm: snapshot payload is not an fsm state', cause: { restorable: snapshot.restorable } },
          evidence: evidence({ substrateResponses: [record('restore', 'rejected', snapshot.reading.step, {})] }),
        };
      }
      return {
        ok: true,
        value: { fsm: snapshot.payload, envelope: snapshot.reading.envelope, step: snapshot.reading.step },
        evidence: evidence({ substrateResponses: [record('restore', 'fsm-state', snapshot.reading.step, { current: snapshot.payload.current })] }),
      };
    },

    describeTransitionLaw(): DynamicsResult<TransitionLawDescription, DynamicsEvidence> {
      const rules: TransitionLawRule[] = def.transitions.map((t) => ({
        kind: 'transition',
        from: t.from,
        on: t.on,
        to: t.to,
        guard: t.guard ? `${t.guard.key}=${String(t.guard.equals)}` : '',
      }));
      return {
        ok: true,
        value: {
          kind: 'transition-table',
          rules,
          notes: `accepting: ${def.accepting.join(', ') || 'none'}; first matching guarded transition wins`,
        },
        evidence: evidence({ substrateResponses: [record('describe-law', 'transition-law', 0, { ruleCount: rules.length })] }),
      };
    },
  };
}
