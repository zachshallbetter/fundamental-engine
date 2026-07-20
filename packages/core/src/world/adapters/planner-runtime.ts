/**
 * Corpus adapter: the search planner behind `DynamicsContract` (EXPERIMENTAL, internal).
 *
 * The planner is the corpus **falsification candidate**. Two pre-registered predictions, and what
 * actually happened:
 *
 *   P2a "it will expose a missing termination concept" — CONFIRMED, but not first. The FSM control
 *        exposed it too, which makes termination a general property of lawful evolution rather than a
 *        search idiosyncrasy. See `TransitionLifecycle`.
 *   P2b "its partial law will force `executionKind: 'hybrid'`" — CONFIRMED. This is the first substrate
 *        in the corpus to use that variant, which until now was declared but never exercised.
 *
 * **A contract change that was considered and REJECTED.** The planner's law is partially declarable —
 * expansion order and edge costs are a table, the euclidean heuristic is computed. It is tempting to add
 * a `completeness: 'complete' | 'partial'` field to `TransitionLawDescription` so the planner could
 * publish the declarable half. That was rejected as a **substrate convenience**, not a missing general
 * concept: `declareTransitionLaw` already answers the question truthfully by being **false** — this
 * substrate cannot declare *the* transition law. Wanting to share part of it is a feature request, and
 * the corpus rule is that convenience is a rejection, not a justification.
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
} from '../dynamics.ts';
import { expandPlanner, initialPlannerState, isTerminal, isPlannerState, extractPlan } from '../substrates/planner.ts';
import type { PlannerProblem, PlannerState, PlannerStatus } from '../substrates/planner.ts';

export interface PlannerSubstrateState {
  readonly planner: PlannerState;
  readonly envelope: WorldVersionEnvelope;
  readonly step: number;
}

/** A search has nothing to feed it — each transition is simply "expand once". */
export interface PlannerAdvanceInput {
  readonly expand?: 1;
}

export interface PlannerAdvanceOutput {
  readonly status: PlannerStatus;
  readonly expanded?: string;
  readonly plan?: readonly string[];
}

const SOURCE = { kind: 'substrate', id: 'search-planner' } as const;

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

const STATUS_INDEX: Readonly<Record<PlannerStatus, number>> = { searching: 0, 'goal-reached': 1, exhausted: 2 };

function reading(state: PlannerSubstrateState): WorldStateSnapshot {
  return {
    envelope: state.envelope,
    step: state.step,
    entities: state.planner.explored.map((id) => ({ id, metrics: { cost: state.planner.costSoFar[id] ?? 0 } })),
    metrics: {
      frontier: state.planner.frontier.length,
      explored: state.planner.explored.length,
      expansions: state.planner.expansions,
      status: STATUS_INDEX[state.planner.status],
      terminal: isTerminal(state.planner.status) ? 1 : 0,
    },
  };
}

export function plannerDynamics(
  world: World,
  problem: PlannerProblem,
): DynamicsContract<PlannerSubstrateState, PlannerAdvanceInput, PlannerAdvanceOutput> {
  return {
    identity: { id: `planner:${problem.id}:${world.envelope.worldInstance}`, version: '0.1.0' },
    // partly a declared table (edges, costs, expansion order), partly computed (the heuristic)
    executionKind: 'hybrid',
    capabilities: {
      initialize: true,
      advance: true,
      snapshot: true,
      restore: true,
      replay: true,
      inspectInternalState: true,
      declareTransitionLaw: false, // cannot declare THE law — the heuristic is not expressible as data
      deterministicReplay: true,
    },
    determinism: {
      classification: 'deterministic',
      controlledInputs: ['problem-graph', 'heuristic', 'frontier-tie-break'],
      uncontrolledInputs: [], // no clock, no RNG; ties break by node id
      requirements: ['identical problem', 'identical expansion count'],
    },

    initialize(request): DynamicsResult<PlannerSubstrateState, DynamicsEvidence> {
      const declared = request.declaration as World;
      return {
        ok: true,
        value: {
          planner: initialPlannerState(problem),
          envelope: declared?.envelope ?? createWorldEnvelope('planner-world'),
          step: 0,
        },
        evidence: evidence({
          declaredInputs: [record('init', 'declaration', 0, { problem: problem.id, nodes: problem.nodes.length, edges: problem.edges.length, heuristic: problem.heuristic.kind })],
        }),
      };
    },

    advance(state, _input, context): DynamicsResult<Transition<PlannerSubstrateState, PlannerAdvanceOutput>, DynamicsEvidence> {
      const step = expandPlanner(problem, state.planner);
      const terminal = isTerminal(step.status);
      // a finished search does not advance its step counter — asking again is neither progress nor error
      const nextStep = terminal && step.expanded === undefined ? state.step : state.step + 1;
      const next: PlannerSubstrateState = { planner: step.state, envelope: state.envelope, step: nextStep };

      return {
        ok: true,
        value: {
          state: next,
          output: {
            status: step.status,
            ...(step.expanded !== undefined ? { expanded: step.expanded } : {}),
            ...(step.status === 'goal-reached' ? { plan: extractPlan(problem, step.state) } : {}),
          },
          lifecycle: terminal ? 'terminal' : 'continuing',
        },
        evidence: evidence({
          declaredInputs: [record('advance-input', 'expand', context.step, {})],
          substrateResponses: [record('advance-response', 'status', nextStep, { status: step.status, expanded: step.expanded })],
          executionTrace: [
            {
              id: `p-${nextStep}`,
              step: nextStep,
              source: SOURCE,
              summary: step.expanded ? `expanded ${step.expanded} → ${step.status}` : `already ${step.status}`,
            },
          ],
          unresolvedInterpretations: [
            // the runtime found a cheapest path under the declared costs; it must not claim it is "best"
            { id: 'plan-quality', claim: 'the returned plan is the one a participant would prefer', authority: 'empirical', status: 'unresolved' },
          ],
        }),
      };
    },

    snapshot(state, _context): DynamicsResult<DynamicsSnapshot, DynamicsEvidence> {
      return {
        ok: true,
        value: { reading: reading(state), restorable: true, payload: { ...state.planner } },
        evidence: evidence({ substrateResponses: [record('snapshot', 'planner-state', state.step, { status: state.planner.status })] }),
      };
    },

    restore(snapshot, _context): DynamicsResult<PlannerSubstrateState, DynamicsEvidence> {
      if (!snapshot.restorable || !isPlannerState(snapshot.payload)) {
        return {
          ok: false,
          error: { code: 'invalid-state', message: 'planner: snapshot payload is not a planner state', cause: { restorable: snapshot.restorable } },
          evidence: evidence({ substrateResponses: [record('restore', 'rejected', snapshot.reading.step, {})] }),
        };
      }
      return {
        ok: true,
        value: { planner: snapshot.payload, envelope: snapshot.reading.envelope, step: snapshot.reading.step },
        evidence: evidence({ substrateResponses: [record('restore', 'planner-state', snapshot.reading.step, { status: snapshot.payload.status })] }),
      };
    },
  };
}
