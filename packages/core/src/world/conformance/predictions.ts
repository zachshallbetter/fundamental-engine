/**
 * Prediction registry and accuracy metric (EXPERIMENTAL, internal).
 *
 * Contract stability and predictive power are different things, and only one of them is evidence of
 * maturity. A contract nobody ever changes might be stable because it is right, or because nobody is
 * testing it hard. What distinguishes a maturing theory is that it **predicts where it will fail**, and
 * is surprised only in specific, explainable ways.
 *
 * So every substrate adaptation registers its expectations BEFORE adapting, and they are graded
 * afterwards whether or not they held.
 *
 * ## Two hazards this file is designed against
 *
 * **1. The slush bucket.** `partially-confirmed` is the grade that lets a wrong prediction feel
 * half-right. It is therefore only available to predictions that declared **two or more independent
 * components in advance**, each graded separately. A single-component prediction can only be confirmed
 * or falsified. `gradingProblems()` enforces this.
 *
 * **2. Self-grading.** These predictions are written and graded by the same author who writes the
 * contract, so the accuracy number is not independent evidence. The real guarantee is commit order:
 * `registeredIn` names the commit that recorded the prediction, and it must predate the adaptation.
 * The metric is a discipline, not a proof — stated here rather than in a footnote.
 */

export type PredictionId = `P-${string}`;

export type PredictionGrade = 'confirmed' | 'partially-confirmed' | 'falsified' | 'pending';

export interface PredictionComponent {
  readonly claim: string;
  readonly held: boolean;
}

export interface Prediction {
  readonly id: PredictionId;
  readonly subject: string;
  readonly statement: string;
  /** The commit that registered this prediction. Must predate the adaptation that grades it. */
  readonly registeredIn: string;
  readonly grade: PredictionGrade;
  /** Required for `partially-confirmed`; at least two, each independently graded. */
  readonly components?: readonly PredictionComponent[];
  /** What actually happened. Required for every graded prediction. */
  readonly outcome?: string;
  /** For falsified predictions: why the miss was informative. Falsifications are kept, never rewritten. */
  readonly lesson?: string;
}

export function predictions(): Prediction[] {
  return [
    {
      id: 'P-001',
      subject: 'FiniteStateMachine',
      statement: 'The FSM control will require zero contract change — it is the most contract-shaped substrate imaginable.',
      registeredIn: 'd90b3bd2',
      grade: 'falsified',
      outcome: 'Churn 1. Accepting states finish, and the contract could not express termination without leaking substrate semantics.',
      lesson:
        'The miss was not about state machines. The contract lacked a concept that no prior substrate could exhibit, because neither the field nor the governor ever terminates. A control failing is the strongest available signal that a theory is incomplete rather than merely untested.',
    },
    {
      id: 'P-002',
      subject: 'SearchPlanner',
      statement: 'The planner will expose a missing termination concept, classified structural rather than convenience.',
      registeredIn: 'd90b3bd2',
      grade: 'partially-confirmed',
      components: [
        { claim: 'a termination concept is missing from the contract', held: true },
        { claim: 'the planner is the substrate that reveals it', held: false },
        { claim: 'the change is structural, not a convenience', held: true },
      ],
      outcome:
        'The gap was real and structural, but the FSM control reached it first, so the planner cost 0. Termination is general, not search-specific.',
    },
    {
      id: 'P-003',
      subject: 'SearchPlanner',
      statement: "The planner's partially-declarable law will force executionKind 'hybrid', a variant declared in F1.3 but never exercised.",
      registeredIn: 'd90b3bd2',
      grade: 'confirmed',
      outcome:
        "Confirmed. First substrate to use 'hybrid'. Weakened by author bias: the variant was known to exist while a planner with a computed heuristic was being chosen.",
    },
    {
      id: 'P-004',
      subject: 'EventSourcedAggregate',
      statement:
        'Churn 0: the existing replay / deterministicReplay split already separates log-replay from deterministic re-execution. If it does not, the distinction was cosmetic.',
      registeredIn: 'd90b3bd2',
      grade: 'pending',
    },

    // --- projection phase, registered before that phase begins
    {
      id: 'P-005',
      subject: 'Projection / authority presentation',
      statement:
        'Authority presentation requires no new concept: presented-vs-effective already covers it, including delegated authority, which reduces to a grant with a different authoritySource.',
      registeredIn: 'pending-registration',
      grade: 'pending',
    },
    {
      id: 'P-006',
      subject: 'Projection / composition',
      statement:
        'Projecting a projection will expose a structural gap. The subtractive-power guarantee is proven only for one projection over a source; composition is untested, and evidence access in particular is expected not to compose.',
      registeredIn: 'pending-registration',
      grade: 'pending',
    },
    {
      id: 'P-007',
      subject: 'Projection / participant-relative state',
      statement:
        'Participant-relative state requires no participant model: it reduces to observation access plus scope, with belief remaining an unresolved obligation.',
      registeredIn: 'pending-registration',
      grade: 'pending',
    },
    {
      id: 'P-008',
      subject: 'Projection / invariant scope',
      statement:
        'Invariant scope needs one further distinction the current foundation lacks: an invariant that is unevaluable on a surface is not the same as one that is vacuously satisfied there.',
      registeredIn: 'pending-registration',
      grade: 'pending',
    },
  ];
}

export interface PredictionProblem {
  readonly id: PredictionId;
  readonly rule: string;
  readonly detail: string;
}

/** Enforces the grading discipline. A registry that cannot be audited is not evidence. */
export function gradingProblems(): PredictionProblem[] {
  const problems: PredictionProblem[] = [];
  for (const p of predictions()) {
    if (p.grade === 'partially-confirmed') {
      const n = p.components?.length ?? 0;
      if (n < 2) {
        problems.push({ id: p.id, rule: 'partial-requires-components', detail: 'partially-confirmed requires >= 2 pre-declared components' });
      } else {
        const held = p.components!.filter((c) => c.held).length;
        if (held === 0) problems.push({ id: p.id, rule: 'partial-requires-a-hit', detail: 'no component held — this is falsified' });
        if (held === n) problems.push({ id: p.id, rule: 'partial-requires-a-miss', detail: 'every component held — this is confirmed' });
      }
    }
    if (p.grade !== 'pending' && !p.outcome) {
      problems.push({ id: p.id, rule: 'graded-requires-outcome', detail: 'a graded prediction must record what actually happened' });
    }
    if (p.grade === 'falsified' && !p.lesson) {
      problems.push({ id: p.id, rule: 'falsified-requires-lesson', detail: 'falsifications are preserved with what they taught, never merely recorded' });
    }
    if (p.grade !== 'pending' && (p.registeredIn === 'pending-registration' || p.registeredIn.length === 0)) {
      problems.push({ id: p.id, rule: 'graded-requires-registration', detail: 'a graded prediction must name the commit that registered it' });
    }
  }
  return problems;
}

export interface PredictionAccuracy {
  readonly total: number;
  readonly graded: number;
  readonly confirmed: number;
  readonly partiallyConfirmed: number;
  readonly falsified: number;
  readonly pending: number;
  /** Confirmed / graded. Partial credit is NOT awarded — a partial is not most of a hit. */
  readonly accuracy: number;
  /** Falsified / graded. Tracked deliberately: a program with zero surprises is not being tested. */
  readonly surpriseRate: number;
  readonly auditable: boolean;
}

export function predictionAccuracy(): PredictionAccuracy {
  const all = predictions();
  const graded = all.filter((p) => p.grade !== 'pending');
  const count = (g: PredictionGrade) => all.filter((p) => p.grade === g).length;
  const confirmed = count('confirmed');
  const falsified = count('falsified');
  return {
    total: all.length,
    graded: graded.length,
    confirmed,
    partiallyConfirmed: count('partially-confirmed'),
    falsified,
    pending: count('pending'),
    accuracy: graded.length === 0 ? 0 : confirmed / graded.length,
    surpriseRate: graded.length === 0 ? 0 : falsified / graded.length,
    auditable: gradingProblems().length === 0,
  };
}
