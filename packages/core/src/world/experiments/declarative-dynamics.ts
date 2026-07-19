/**
 * F1.5 — Declarative FieldDynamics experiment (BOUNDED). Tests whether force laws can be represented as
 * DATA (a typed expression IR) rather than executable code. This is a scientific experiment: a partial or
 * negative result is valid. The IR is deliberately minimal — NO callbacks, script strings, eval,
 * Function, or general-purpose language encoded as data. If a law needs any of those, it is classified
 * `opaque-only`; the IR is NOT expanded to force success.
 *
 * Corpus: representative laws modeled on the engine's real force categories (attract/gravity =
 * distance-dependent, cohesion = relation-dependent, gravity constant = environment-dependent, sink =
 * stateful, etc. — see `forces/`). This experiment characterizes CATEGORY representability, not the exact
 * 36 force functions. Field-free; internal; not exported from the package entry.
 */

// ── the minimal typed expression IR (closed union — no dynamic dispatch, no callbacks) ──

export type Expr =
  | { readonly op: 'const'; readonly value: number }
  | { readonly op: 'var'; readonly name: string }
  | { readonly op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max'; readonly a: Expr; readonly b: Expr }
  | { readonly op: 'neg'; readonly a: Expr }
  | { readonly op: 'clamp'; readonly x: Expr; readonly lo: Expr; readonly hi: Expr }
  | { readonly op: 'ifGte'; readonly x: Expr; readonly threshold: Expr; readonly then: Expr; readonly otherwise: Expr };

export type ExprContext = Readonly<Record<string, number>>;

export function evalExpr(e: Expr, ctx: ExprContext): number {
  switch (e.op) {
    case 'const': return e.value;
    case 'var': {
      const v = ctx[e.name];
      if (v === undefined) throw new Error(`declarative-dynamics: unbound var "${e.name}"`);
      return v;
    }
    case 'add': return evalExpr(e.a, ctx) + evalExpr(e.b, ctx);
    case 'sub': return evalExpr(e.a, ctx) - evalExpr(e.b, ctx);
    case 'mul': return evalExpr(e.a, ctx) * evalExpr(e.b, ctx);
    case 'div': return evalExpr(e.a, ctx) / evalExpr(e.b, ctx);
    case 'min': return Math.min(evalExpr(e.a, ctx), evalExpr(e.b, ctx));
    case 'max': return Math.max(evalExpr(e.a, ctx), evalExpr(e.b, ctx));
    case 'neg': return -evalExpr(e.a, ctx);
    case 'clamp': return Math.min(Math.max(evalExpr(e.x, ctx), evalExpr(e.lo, ctx)), evalExpr(e.hi, ctx));
    case 'ifGte': return evalExpr(e.x, ctx) >= evalExpr(e.threshold, ctx) ? evalExpr(e.then, ctx) : evalExpr(e.otherwise, ctx);
  }
}

// small expression builders (readability)
const k = (value: number): Expr => ({ op: 'const', value });
const v = (name: string): Expr => ({ op: 'var', name });
const mul = (a: Expr, b: Expr): Expr => ({ op: 'mul', a, b });
const sub = (a: Expr, b: Expr): Expr => ({ op: 'sub', a, b });
const div = (a: Expr, b: Expr): Expr => ({ op: 'div', a, b });
const add = (a: Expr, b: Expr): Expr => ({ op: 'add', a, b });
const max = (a: Expr, b: Expr): Expr => ({ op: 'max', a, b });
const ifGte = (x: Expr, threshold: Expr, then: Expr, otherwise: Expr): Expr => ({ op: 'ifGte', x, threshold, then, otherwise });

// ── force corpus ─────────────────────────────────────────────────────────────

export type ForceClass =
  | 'declarative-expression'
  | 'declarative-stateful'
  | 'declarative-with-opaque-extension'
  | 'opaque-only';

export type OpaqueReason =
  | 'unsupported-input'
  | 'hidden-mutable-state'
  | 'host-dependence'
  | 'callback-dependence'
  | 'dynamic-dispatch'
  | 'unbounded-computation'
  | 'semantic-mismatch'
  | 'excessive-representation-cost';

/** Fully-defined inputs for the imperative laws (avoids indexed-access `undefined`). */
export interface SampleInputs {
  readonly strength: number;
  readonly dist: number;
  readonly range: number;
  readonly relationStrength: number;
  readonly envG: number;
  readonly mass: number;
  readonly t: number;
}

export interface ForceCase {
  readonly id: string;
  readonly category: string;
  readonly modeledOn: string;
  /** The "original apply(...)" analog — imperative core computation. `state` present only for stateful laws. */
  readonly imperative: (ctx: SampleInputs, state: { acc: number } | undefined) => number;
  /** The declarative encoding, or null when the law is NOT representable in the pure IR. */
  readonly declarative: Expr | null;
  readonly classification: ForceClass;
  readonly reason?: OpaqueReason;
  /** For stateful laws: the input var that surfaces the prior state (declarative-stateful). */
  readonly statePriorVar?: string;
}

// a closure-captured hidden accumulator — NOT surfaceable → opaque-only
function makeClosureStatefulLaw(): (ctx: SampleInputs) => number {
  let hidden = 0;
  return (ctx) => {
    hidden += ctx.strength;
    return hidden;
  };
}
const closureLaw = makeClosureStatefulLaw();

// a host callback the IR cannot represent as data
function hostCallback(): number {
  return 42; // stands in for host geometry / external query
}

export const FORCE_CORPUS: readonly ForceCase[] = [
  {
    id: 'parameterized-constant', category: 'constant/parameterized', modeledOn: 'strength scalar',
    imperative: (c) => c.strength, declarative: v('strength'), classification: 'declarative-expression',
  },
  {
    id: 'distance-falloff', category: 'distance-dependent', modeledOn: 'attract / gravity',
    imperative: (c) => c.strength * Math.max(0, 1 - c.dist / c.range),
    declarative: mul(v('strength'), max(k(0), sub(k(1), div(v('dist'), v('range'))))),
    classification: 'declarative-expression',
  },
  {
    id: 'relation-scaled', category: 'relation-dependent', modeledOn: 'cohesion',
    imperative: (c) => c.relationStrength * c.strength,
    declarative: mul(v('relationStrength'), v('strength')), classification: 'declarative-expression',
  },
  {
    id: 'environment-constant', category: 'environment-dependent', modeledOn: 'gravity G',
    imperative: (c) => c.envG * c.mass, declarative: mul(v('envG'), v('mass')), classification: 'declarative-expression',
  },
  {
    id: 'range-threshold', category: 'threshold/conditional', modeledOn: 'screen / cutoff',
    imperative: (c) => (c.range >= c.dist ? c.strength : 0),
    declarative: ifGte(v('range'), v('dist'), v('strength'), k(0)), classification: 'declarative-expression',
  },
  {
    id: 'composed', category: 'composition', modeledOn: 'attract + cohesion',
    imperative: (c) => c.strength * Math.max(0, 1 - c.dist / c.range) + c.relationStrength * c.strength,
    declarative: add(mul(v('strength'), max(k(0), sub(k(1), div(v('dist'), v('range'))))), mul(v('relationStrength'), v('strength'))),
    classification: 'declarative-expression',
  },
  {
    id: 'time-linear', category: 'time-dependent (linear)', modeledOn: 'linear decay',
    imperative: (c) => c.strength * c.t, declarative: mul(v('strength'), v('t')), classification: 'declarative-expression',
  },
  {
    id: 'state-surfaced', category: 'mutable state (surfaced)', modeledOn: 'sink accretion (--load)',
    imperative: (c, s) => { s!.acc += c.strength; return s!.acc; },
    // surfaces prior state as an input var; output IS the next state: acc' = accPrior + strength
    declarative: add(v('accPrior'), v('strength')), classification: 'declarative-stateful', statePriorVar: 'accPrior',
  },
  {
    id: 'time-sinusoidal', category: 'time-dependent (nonlinear)', modeledOn: 'oscillatory drift',
    imperative: (c) => c.strength * Math.sin(c.t), declarative: null,
    classification: 'opaque-only', reason: 'unsupported-input',
  },
  {
    id: 'closure-state', category: 'mutable state (closure-captured)', modeledOn: 'induced charge accumulation',
    imperative: (c) => closureLaw(c), declarative: null,
    classification: 'opaque-only', reason: 'hidden-mutable-state',
  },
  {
    id: 'host-callback', category: 'host/callback dependence', modeledOn: 'host geometry / external query',
    imperative: () => hostCallback(), declarative: null,
    classification: 'opaque-only', reason: 'callback-dependence',
  },
];

// ── characterization ─────────────────────────────────────────────────────────

export interface ForceCharacterization {
  readonly id: string;
  readonly category: string;
  readonly classification: ForceClass;
  readonly reason?: OpaqueReason;
  /** For declarative laws: max abs difference imperative-vs-declarative over the samples. null if opaque. */
  readonly maxDelta: number | null;
  readonly matchesUnderTolerance: boolean | null;
}

const SAMPLE_CONTEXTS: readonly SampleInputs[] = [
  { strength: 1, dist: 10, range: 200, relationStrength: 0.5, envG: 9.8, mass: 2, t: 0 },
  { strength: 0.5, dist: 150, range: 200, relationStrength: 0.8, envG: 9.8, mass: 1, t: 1 },
  { strength: 2, dist: 250, range: 200, relationStrength: 0.2, envG: 9.8, mass: 3, t: 2.5 },
];

export function characterize(force: ForceCase, tolerance: number): ForceCharacterization {
  if (force.declarative === null) {
    return { id: force.id, category: force.category, classification: force.classification, reason: force.reason, maxDelta: null, matchesUnderTolerance: null };
  }
  let maxDelta = 0;
  // stateful laws thread prior-state through both paths so the comparison is per-step
  const impState = { acc: 0 };
  let declPriorAcc = 0;
  for (const ctx of SAMPLE_CONTEXTS) {
    const impOut = force.imperative(ctx, impState);
    const declCtx: ExprContext = force.statePriorVar ? { ...ctx, [force.statePriorVar]: declPriorAcc } : { ...ctx };
    const declOut = evalExpr(force.declarative, declCtx);
    if (force.statePriorVar) declPriorAcc = declOut; // thread the surfaced state forward
    maxDelta = Math.max(maxDelta, Math.abs(impOut - declOut));
  }
  return { id: force.id, category: force.category, classification: force.classification, reason: force.reason, maxDelta, matchesUnderTolerance: maxDelta <= tolerance };
}

export interface ExperimentResult {
  readonly outcome: 'complete-declarative' | 'partial-with-opaque-extensions' | 'negative';
  readonly total: number;
  readonly byClass: Readonly<Record<ForceClass, number>>;
  readonly nonTrivialDeclarative: number; // representable laws beyond bare constants
  readonly boundary: string;
  readonly characterizations: readonly ForceCharacterization[];
}

export function runExperiment(tolerance: number): ExperimentResult {
  const characterizations = FORCE_CORPUS.map((f) => characterize(f, tolerance));
  const byClass: Record<ForceClass, number> = {
    'declarative-expression': 0, 'declarative-stateful': 0, 'declarative-with-opaque-extension': 0, 'opaque-only': 0,
  };
  for (const f of FORCE_CORPUS) byClass[f.classification] += 1;
  const declarativeTotal = byClass['declarative-expression'] + byClass['declarative-stateful'] + byClass['declarative-with-opaque-extension'];
  const nonTrivialDeclarative = FORCE_CORPUS.filter((f) => f.declarative !== null && f.category !== 'constant/parameterized').length;
  const outcome: ExperimentResult['outcome'] =
    byClass['opaque-only'] === 0 ? 'complete-declarative'
      : declarativeTotal === 0 || nonTrivialDeclarative === 0 ? 'negative'
        : 'partial-with-opaque-extensions';
  const boundary =
    'Pure algebraic / threshold / composition / parameterized / distance / relation / environment / ' +
    'linear-time laws, plus explicitly-surfaced state, are declarative. Nonlinear-time (needs functions ' +
    'the IR does not carry), closure-captured hidden state, and host/callback dependence are opaque-only. ' +
    'The IR was NOT expanded (no trig, callbacks, eval, or Function) to force representation.';
  return { outcome, total: FORCE_CORPUS.length, byClass, nonTrivialDeclarative, boundary, characterizations };
}
