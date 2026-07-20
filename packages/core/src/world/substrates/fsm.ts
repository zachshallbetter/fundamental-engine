/**
 * Conformance-corpus substrate: a finite state machine (EXPERIMENTAL, internal).
 *
 * Written from FSM semantics, with the API an FSM library would naturally have — declared states, a
 * declared transition table, data guards, accepting (final) states, and an outcome per fired event.
 * It has NO knowledge of `DynamicsContract`; per the corpus protocol it is committed before its adapter
 * exists and may not be edited to make that adapter cleaner.
 *
 * Its role in the corpus is the **control**: an FSM is the most contract-shaped substrate imaginable
 * (explicit states, declared law, complete observable state, exact determinism, trivial restore), so it
 * was pre-registered as expected to require zero contract change.
 *
 * Pure functions: state in → state out. Guards are data, never predicates-as-callbacks.
 */

export type FsmValue = number | string | boolean;

/** A guard is a declared equality on context — expressible as data, so the law stays inspectable. */
export interface FsmGuard {
  readonly key: string;
  readonly equals: FsmValue;
}

export interface FsmTransition {
  readonly from: string;
  readonly on: string;
  readonly to: string;
  readonly guard?: FsmGuard;
  /** Context writes applied when this transition is taken. */
  readonly assign?: Readonly<Record<string, FsmValue>>;
}

export interface FsmDefinition {
  readonly id: string;
  readonly initial: string;
  readonly states: readonly string[];
  /** Accepting states. Reaching one means the machine is DONE — not merely idle. */
  readonly accepting: readonly string[];
  readonly transitions: readonly FsmTransition[];
  readonly context?: Readonly<Record<string, FsmValue>>;
}

export interface FsmState {
  readonly current: string;
  readonly context: Readonly<Record<string, FsmValue>>;
  readonly steps: number;
}

/**
 * Why an event did or did not move the machine. `accepted` is distinct from `no-transition`: an
 * accepting state is finished, whereas a non-accepting state with no matching transition is merely
 * idle and will still respond to a different event.
 */
export type FsmOutcome = 'transitioned' | 'no-transition' | 'guard-blocked' | 'unknown-event' | 'accepted';

export interface FsmFireResult {
  readonly state: FsmState;
  readonly outcome: FsmOutcome;
  readonly taken?: FsmTransition;
}

export function initialFsmState(def: FsmDefinition): FsmState {
  return { current: def.initial, context: { ...(def.context ?? {}) }, steps: 0 };
}

export function isAccepting(def: FsmDefinition, state: FsmState): boolean {
  return def.accepting.includes(state.current);
}

export function isFsmState(v: unknown): v is FsmState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.current === 'string' && typeof s.steps === 'number' && typeof s.context === 'object' && s.context !== null;
}

function guardHolds(guard: FsmGuard | undefined, context: Readonly<Record<string, FsmValue>>): boolean {
  if (!guard) return true;
  return context[guard.key] === guard.equals;
}

/** Fire one event. An accepting state consumes nothing further — the machine is done. */
export function fireFsm(def: FsmDefinition, state: FsmState, event: string): FsmFireResult {
  if (isAccepting(def, state)) {
    return { state, outcome: 'accepted' };
  }

  const fromHere = def.transitions.filter((t) => t.from === state.current);
  const onEvent = fromHere.filter((t) => t.on === event);
  if (onEvent.length === 0) {
    // distinguish "this machine has no such event anywhere" from "not from this state"
    const knownEvent = def.transitions.some((t) => t.on === event);
    return { state, outcome: knownEvent ? 'no-transition' : 'unknown-event' };
  }

  const taken = onEvent.find((t) => guardHolds(t.guard, state.context));
  if (!taken) return { state, outcome: 'guard-blocked' };

  return {
    state: {
      current: taken.to,
      context: taken.assign ? { ...state.context, ...taken.assign } : state.context,
      steps: state.steps + 1,
    },
    outcome: 'transitioned',
    taken,
  };
}
