/**
 * Negative results registry (EXPERIMENTAL, internal).
 *
 * A negative result is a hypothesis that **survived pre-registration and adaptation and was then
 * disproven**. It is not a rejected convenience (those are refinements the contract declined) and not
 * merely a regraded prediction — when a prediction is regraded, the intuition behind it disappears from
 * the record unless it is captured here.
 *
 * The history of what a research program stopped believing is often more informative than the list of
 * what it accepted, because the abandoned intuitions are the ones a later reader is most likely to
 * re-propose. Entries are therefore **permanent**: never deleted, never renumbered, never rewritten into
 * a prediction update. A superseded entry is marked, not removed.
 *
 * Several entries below predate the registry and were reconstructed from Stage-1 findings that are
 * documented elsewhere in the repository. That is noted per entry — a reconstructed entry is weaker
 * evidence of protocol discipline than one recorded at the time, and should not be presented otherwise.
 */
import type { PredictionId } from './predictions.ts';

export type NegativeResultId = `N-${string}`;

export type NegativeStatus =
  /** Held as a working assumption, then disproven by evidence. */
  | 'falsified'
  /** Registered, not yet tested. */
  | 'pending'
  /** Falsified earlier, then replaced by a better-stated hypothesis (which gets its own id). */
  | 'superseded';

export interface NegativeResult {
  readonly id: NegativeResultId;
  /** The belief, stated as it was actually held — not softened in hindsight. */
  readonly hypothesis: string;
  readonly status: NegativeStatus;
  /** What disproved it. Required once falsified. */
  readonly falsifiedBy?: string;
  readonly reason?: string;
  /** True when the entry was reconstructed after the fact rather than recorded when abandoned. */
  readonly reconstructed?: boolean;
  readonly prediction?: PredictionId;
  readonly supersededBy?: NegativeResultId;
}

export function negativeResults(): NegativeResult[] {
  return [
    {
      id: 'N-001',
      hypothesis: 'Termination is specific to search and planning substrates.',
      status: 'falsified',
      falsifiedBy: 'FiniteStateMachine',
      reason:
        'the FSM control reached termination first via accepting states, showing it is a general property of lawful evolution rather than a search idiosyncrasy. The contract had not merely omitted it — no prior substrate could exhibit it, because neither the field nor the governor ever finishes',
      prediction: 'P-002',
    },
    {
      id: 'N-002',
      hypothesis: 'Projection composition preserves subtractive power: projecting a projection cannot launder what the first layer withheld.',
      status: 'pending',
      prediction: 'P-006',
    },
    {
      id: 'N-003',
      hypothesis: 'A CompiledPattern is a complete world declaration, so the kernel can host field evolution directly.',
      status: 'falsified',
      falsifiedBy: 'F1.1 field-integration audit',
      reason:
        'lawful evolution exists only as executable force code, not as data. This falsification reframed the whole of Stage 1: the field became one execution substrate behind a contract rather than the world itself',
      reconstructed: true,
    },
    {
      id: 'N-004',
      hypothesis: 'Field dynamics is fully expressible as declarative data given a sufficient expression IR.',
      status: 'falsified',
      falsifiedBy: 'F1.5 declarative-dynamics experiment',
      reason:
        '8 of 11 corpus laws were expressible; 3 remained opaque (hidden mutable state, host/callback dependence, nonlinear time). The IR was deliberately not expanded to force success, so the result stands as partial-with-opaque-extensions',
      reconstructed: true,
    },
    {
      id: 'N-005',
      hypothesis: 'DynamicsExecutionContext.now is needed by real substrates.',
      status: 'pending',
      reason:
        'four of four adapted substrates have now declined to use it — the field injects its own clock, the governor, FSM and planner have none. Evidence against is accumulating but the concept was deliberately kept rather than removed, since absence of use across four substrates is not proof of uselessness',
      reconstructed: true,
    },
  ];
}

export interface NegativeResultProblem {
  readonly id: NegativeResultId;
  readonly rule: string;
  readonly detail: string;
}

export function negativeResultProblems(): NegativeResultProblem[] {
  const problems: NegativeResultProblem[] = [];
  for (const n of negativeResults()) {
    if (n.status === 'falsified') {
      if (!n.falsifiedBy) problems.push({ id: n.id, rule: 'falsified-requires-source', detail: 'must name what disproved it' });
      if (!n.reason || n.reason.length < 40) {
        problems.push({ id: n.id, rule: 'falsified-requires-reason', detail: 'must record why, at enough length to be useful later' });
      }
    }
    if (n.status === 'superseded' && !n.supersededBy) {
      problems.push({ id: n.id, rule: 'superseded-requires-successor', detail: 'a superseded entry must name its successor, never simply vanish' });
    }
    if (n.status === 'pending' && n.falsifiedBy) {
      problems.push({ id: n.id, rule: 'pending-has-no-source', detail: 'a pending hypothesis cannot already have been falsified' });
    }
  }
  return problems;
}

export interface NegativeLedger {
  readonly total: number;
  readonly falsified: number;
  readonly pending: number;
  readonly superseded: number;
  /** Entries reconstructed after the fact — weaker evidence of discipline than contemporaneous ones. */
  readonly reconstructed: number;
  readonly auditable: boolean;
}

export function negativeLedger(): NegativeLedger {
  const all = negativeResults();
  const count = (s: NegativeStatus) => all.filter((n) => n.status === s).length;
  return {
    total: all.length,
    falsified: count('falsified'),
    pending: count('pending'),
    superseded: count('superseded'),
    reconstructed: all.filter((n) => n.reconstructed).length,
    auditable: negativeResultProblems().length === 0,
  };
}
