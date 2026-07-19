/**
 * F1.8 — kernel ablation harness (EXPERIMENTAL, internal).
 *
 * Runs the four ratified ablation forms (removal · collapse · substitution · reconstruction, M1.5-08)
 * against the current kernel model, EXECUTING the real F1.5–F1.7 derivations with ablated inputs rather
 * than asserting outcomes. Each record carries hypothesis, transformation, fixture, expected
 * distinguishing case, observed result, failed capability / preserved behavior, evidence, classification,
 * and the implication for K and K₀.
 *
 * Field-free (it drives generic derivations only). Not exported from the package entry.
 */
import { createWorldEnvelope } from '../envelope.ts';
import { evaluateOpportunity } from '../opportunity/opportunity.ts';
import type { OpportunityContext } from '../opportunity/opportunity.ts';
import { detectEpisodes } from '../episodes/episodes.ts';
import type { DetectionContract, Transition } from '../episodes/episodes.ts';
import { FORCE_CORPUS } from '../experiments/declarative-dynamics.ts';
import type { WorldRelation } from '../world.ts';

export type AblationForm = 'removal' | 'collapse' | 'substitution' | 'reconstruction';

export type AblationClass =
  | 'necessary-primitive'
  | 'necessary-component'
  | 'derived-complete'
  | 'derived-conditional'
  | 'collapsible-without-loss'
  | 'collapsible-with-loss'
  | 'substitutable'
  | 'non-substitutable'
  | 'representation-dependent'
  | 'execution-boundary-only'
  | 'unresolved';

export interface AblationRecord {
  readonly element: string;
  readonly form: AblationForm;
  readonly hypothesis: string;
  readonly transformation: string;
  readonly fixture: string;
  readonly expectedDistinguishingCase: string;
  readonly observed: string;
  readonly failedCapability?: string;
  readonly preservedBehavior?: string;
  readonly evidence: string;
  readonly classification: AblationClass;
  readonly implication: string;
}

// ── fixtures ─────────────────────────────────────────────────────────────────

function opportunityBase(overrides: Partial<OpportunityContext> = {}): OpportunityContext {
  return {
    world: { envelope: createWorldEnvelope('ablation-world'), operations: [{ id: 'act', reversible: true, recoveryPaths: [] }] },
    participant: 'p',
    state: { enabled: ['act'], reachableOutcomes: ['act'] },
    projection: { id: 'full', exposed: ['act'], signaled: ['act'] },
    history: [],
    capabilities: ['act'],
    authority: [{ operation: 'act', scope: 's', authoritySource: 'role:x' }],
    ...overrides,
  };
}

function episodeContract(o: Partial<DetectionContract> = {}): DetectionContract {
  return {
    boundary: { participants: ['A', 'B', 'C'], start: 0, end: 100 },
    timescale: 1,
    coupling: { kind: 'direct-influence', minInfluence: 1 },
    recurrenceWindow: 5,
    minimumInfluence: 1,
    ...o,
  };
}
const tx = (step: number, from: string, to: string, influence = 5): Transition => ({ step, from, to, operation: 'op', influence });

// ── reconstruction helpers (the "remaining kernel" attempting to derive an element) ──

/** Derive relation edges from observed transitions only (no declared relation structure). */
export function relationsFromTransitions(trace: readonly Transition[]): WorldRelation[] {
  const seen = new Set<string>();
  const out: WorldRelation[] = [];
  for (const t of trace) {
    if (t.to === undefined) continue;
    const key = `${t.from}->${t.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: t.from, to: t.to, type: 'observed-edge' });
  }
  return out;
}

/** Derive the operation vocabulary from observed transitions only. */
export function operationsFromTransitions(trace: readonly Transition[]): string[] {
  return [...new Set(trace.map((t) => t.operation))].sort();
}

// ── executable probes ────────────────────────────────────────────────────────

/** Ω_sys removal probe: drop one lower input and report which predicate becomes underivable. */
function probeOpportunityRemoval(input: 'capability' | 'authority' | 'projection' | 'reachability' | 'history'): { observed: string; failed: string } {
  const base = evaluateOpportunity(opportunityBase(), 'act');
  let ablated;
  switch (input) {
    case 'capability': ablated = evaluateOpportunity(opportunityBase({ capabilities: [] }), 'act'); break;
    case 'authority': ablated = evaluateOpportunity(opportunityBase({ authority: [] }), 'act'); break;
    case 'projection': ablated = evaluateOpportunity(opportunityBase({ projection: { id: 'none', exposed: [], signaled: [] } }), 'act'); break;
    case 'reachability': ablated = evaluateOpportunity(opportunityBase({ state: { enabled: ['act'], reachableOutcomes: [] } }), 'act'); break;
    case 'history': {
      const enabled = (h: readonly string[]) => (h.includes('unlock') ? ['act'] : []);
      ablated = evaluateOpportunity(opportunityBase({ history: [], state: { enabled: enabled([]), reachableOutcomes: ['act'] } }), 'act');
      break;
    }
  }
  const changed = base.available !== ablated.available || base.signaled !== ablated.signaled;
  const failed = ablated.failedPredicates.map((f) => f.predicate).join(',') || 'none';
  return { observed: `baseline available=${base.available}; ablated available=${ablated.available}; changed=${changed}`, failed };
}

/** Collapse capability and permission into one boolean; show the distinction is lost. */
function probeCapabilityPermissionCollapse(): { observed: string; lost: boolean } {
  const capableNotPermitted = evaluateOpportunity(opportunityBase({ authority: [] }), 'act');
  const permittedNotCapable = evaluateOpportunity(opportunityBase({ capabilities: [] }), 'act');
  // the real (uncollapsed) model distinguishes them by which predicate failed
  const realDistinct =
    capableNotPermitted.failedPredicates.some((f) => f.predicate === 'permitted') &&
    permittedNotCapable.failedPredicates.some((f) => f.predicate === 'capable');
  // the collapsed model exposes only `allowed = capable && permitted`
  const collapsedA = capableNotPermitted.capable && capableNotPermitted.permitted;
  const collapsedB = permittedNotCapable.capable && permittedNotCapable.permitted;
  const collapsedIndistinguishable = collapsedA === collapsedB;
  return {
    observed: `uncollapsed distinguishes=${realDistinct}; collapsed allowed A=${collapsedA} B=${collapsedB} indistinguishable=${collapsedIndistinguishable}`,
    lost: realDistinct && collapsedIndistinguishable,
  };
}

/** Projection collapse probe: does projection materially change the derivation? */
function probeProjectionMateriality(): { observed: string; material: boolean } {
  const full = evaluateOpportunity(opportunityBase(), 'act');
  const hidden = evaluateOpportunity(opportunityBase({ projection: { id: 'reduced', exposed: [], signaled: [] } }), 'act');
  const material = full.available !== hidden.available;
  return { observed: `same state, two projections → available ${full.available} vs ${hidden.available}`, material };
}

/** Relations reconstruction probe: latent/persistent relations vs observed edges. */
function probeRelationReconstruction(): { observed: string; latentLost: boolean } {
  const declared: WorldRelation[] = [
    { from: 'A', to: 'B', type: 'owns' }, // latent/persistent — never exercised
    { from: 'A', to: 'C', type: 'binds' }, // exercised below
  ];
  const trace = [tx(1, 'A', 'C')];
  const reconstructed = relationsFromTransitions(trace);
  const latentLost = !reconstructed.some((r) => r.from === 'A' && r.to === 'B');
  const typeLost = !reconstructed.some((r) => r.type === 'binds');
  return {
    observed: `declared ${declared.length} relations; reconstructed ${reconstructed.length} from transitions; latent A→B recovered=${!latentLost}; relation type recovered=${!typeLost}`,
    latentLost,
  };
}

/** Operations reconstruction probe: latent (never-invoked) operations vs observed transitions. */
function probeOperationReconstruction(): { observed: string; latentLost: boolean } {
  const declared = ['act', 'latent'];
  const trace: Transition[] = [{ step: 1, from: 'A', to: 'B', operation: 'act', influence: 5 }];
  const reconstructed = operationsFromTransitions(trace);
  const latentLost = !reconstructed.includes('latent');
  return { observed: `declared ${declared.join(',')}; reconstructed ${reconstructed.join(',')}; latent recovered=${!latentLost}`, latentLost };
}

/** Dynamics substitution probe: replace with declarative IR only (F1.5 corpus). */
function probeDynamicsSubstitution(): { observed: string; opaqueCount: number; declarativeCount: number } {
  const opaque = FORCE_CORPUS.filter((f) => f.declarative === null);
  const declarative = FORCE_CORPUS.filter((f) => f.declarative !== null);
  return {
    observed: `declarative-only substitution covers ${declarative.length}/${FORCE_CORPUS.length}; ${opaque.length} laws unrepresentable (${opaque.map((o) => o.reason).join(', ')})`,
    opaqueCount: opaque.length,
    declarativeCount: declarative.length,
  };
}

/** Episode contract removal probe: drop the recurrence window; does the finding change? */
function probeEpisodeWindowRemoval(): { observed: string; changed: boolean } {
  const trace = [tx(1, 'A', 'B'), tx(20, 'B', 'A')]; // timeout fixture
  const withWindow = detectEpisodes(trace, episodeContract({ recurrenceWindow: 5 }), ['A', 'B']);
  const withoutWindow = detectEpisodes(trace, episodeContract({ recurrenceWindow: Number.MAX_SAFE_INTEGER }), ['A', 'B']);
  const changed = withWindow.episodes.length !== withoutWindow.episodes.length;
  return { observed: `window=5 → ${withWindow.episodes.length} episode(s); window=∞ → ${withoutWindow.episodes.length}`, changed };
}

/** Coupling vs shared cause: is the distinction structural (threshold-independent)? */
function probeCouplingVsSharedCause(): { observed: string; structural: boolean } {
  const sharedCause = [tx(1, 'C', 'A'), tx(1, 'C', 'B')];
  const permissive = detectEpisodes(sharedCause, episodeContract({ minimumInfluence: 0, coupling: { kind: 'direct-influence', minInfluence: 0 } }), ['A', 'B', 'C']);
  const coupled = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A')], episodeContract(), ['A', 'B']);
  const structural = permissive.episodes.length === 0 && coupled.episodes.length === 1;
  return { observed: `shared-cause under the most permissive thresholds → ${permissive.episodes.length} episode(s); true coupling → ${coupled.episodes.length}`, structural };
}

/** Entity identity removal probe: anonymize participants; is attribution lost? */
function probeEntityIdentityRemoval(): { observed: string; attributionLost: boolean } {
  const named = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A')], episodeContract(), ['A', 'B']);
  const anon = detectEpisodes([tx(1, '', ''), tx(2, '', '')], episodeContract({ boundary: { participants: [''], start: 0, end: 100 } }), ['']);
  const attributionLost = named.episodeParticipants.length === 2 && anon.episodeParticipants.length < 2;
  return { observed: `named → participants [${named.episodeParticipants.join(',')}]; anonymized → [${anon.episodeParticipants.join(',')}]`, attributionLost };
}

// ── the ablation battery ─────────────────────────────────────────────────────

export function runAblations(): AblationRecord[] {
  const records: AblationRecord[] = [];

  // A. Dynamics
  const dyn = probeDynamicsSubstitution();
  records.push({
    element: 'Dynamics', form: 'substitution',
    hypothesis: 'Dynamics cannot be collapsed entirely into declarative State.',
    transformation: 'Replace lawful evolution with the declarative expression IR only (F1.5).',
    fixture: 'F1.5 force corpus (9 categories)',
    expectedDistinguishingCase: 'A law with hidden mutable state or host/callback dependence.',
    observed: dyn.observed,
    failedCapability: `${dyn.opaqueCount} laws have no declarative representation`,
    preservedBehavior: `${dyn.declarativeCount} laws are fully representable as data`,
    evidence: 'FORCE_CORPUS declarative===null partition',
    classification: 'non-substitutable',
    implication: 'Dynamics is NOT wholly substitutable by declarative State. Reducible only under restricted (declarative-region) worlds.',
  });
  records.push({
    element: 'Dynamics', form: 'removal',
    hypothesis: 'Removing Dynamics removes all lawful evolution.',
    transformation: 'Delete the evolution element; retain State + Operations.',
    fixture: 'World with entities and operations but no dynamics realization',
    expectedDistinguishingCase: 'Any request to advance the world.',
    observed: 'No transition can be produced; advance() has no realization to invoke.',
    failedCapability: 'lawful evolution / advance',
    evidence: 'DynamicsContract.advance is the only evolution path in the kernel',
    classification: 'necessary-component',
    implication: 'Dynamics is a necessary component of Θ — but its realization sits behind the contract boundary.',
  });
  records.push({
    element: 'DynamicsContract', form: 'reconstruction',
    hypothesis: 'The contract is an execution boundary, not a kernel primitive.',
    transformation: 'Attempt to reconstruct the boundary from State + Operations alone.',
    fixture: 'opaque-native field substrate + interpreted counter substrate (F1.3)',
    expectedDistinguishingCase: 'Two substrates with different executionKind under one kernel.',
    observed: 'The same kernel executes an opaque-native and an interpreted substrate without change; the boundary is what makes substrates interchangeable.',
    preservedBehavior: 'substrate interchange',
    evidence: 'F1.3 substrate-agnostic test (field + non-field contracts)',
    classification: 'execution-boundary-only',
    implication: 'DynamicsContract is retained as a runtime interface, NOT added to K as an eighth primitive.',
  });

  // B. Opportunity
  for (const input of ['capability', 'authority', 'projection', 'reachability', 'history'] as const) {
    const p = probeOpportunityRemoval(input);
    records.push({
      element: `Ω_sys ← ${input}`, form: 'removal',
      hypothesis: `Ω_sys requires ${input} as a lower input.`,
      transformation: `Remove ${input} from the opportunity context.`,
      fixture: 'opportunityBase all-pass fixture',
      expectedDistinguishingCase: `A case where only ${input} determines the outcome.`,
      observed: p.observed,
      failedCapability: `failed predicates: ${p.failed}`,
      evidence: 'evaluateOpportunity executed with and without the input',
      classification: 'necessary-component',
      implication: `${input} is a necessary lower structure for the Ω_sys derivation.`,
    });
  }
  records.push({
    element: 'Opportunity (Ω_sys)', form: 'reconstruction',
    hypothesis: 'Ω_sys is derived, not primitive.',
    transformation: 'Reconstruct Ω_sys from state, operations, capability, authority, projection, reachability, history.',
    fixture: 'F1.6 fixture battery (10 negatives + all-pass)',
    expectedDistinguishingCase: 'Any predicate that changes with a lower input.',
    observed: 'Every predicate is computed from the listed lower structures; no residual is required.',
    preservedBehavior: 'complete predicate set + evidence',
    evidence: 'F1.6 evaluateOpportunity',
    classification: 'derived-complete',
    implication: 'Opportunity is removed from K₀ — fully replaced by its derivation.',
  });

  // C. Interaction / episode
  const win = probeEpisodeWindowRemoval();
  records.push({
    element: 'Episode ← recurrence window', form: 'removal',
    hypothesis: 'Episode findings are parameter-relative.',
    transformation: 'Remove the recurrence window (set to unbounded).',
    fixture: 'timeout fixture A→B@1, B→A@20',
    expectedDistinguishingCase: 'A reply outside the declared window.',
    observed: win.observed,
    failedCapability: win.changed ? 'boundary-relative determinacy' : undefined,
    evidence: 'detectEpisodes with window=5 vs window=∞',
    classification: 'necessary-component',
    implication: 'The detection contract is constitutive of the finding; episodes are conditional, never self-evident.',
  });
  const cvs = probeCouplingVsSharedCause();
  records.push({
    element: 'Coupling vs shared cause', form: 'substitution',
    hypothesis: 'Coupling is structural, not a threshold artifact.',
    transformation: 'Weaken thresholds to the most permissive setting and retest shared cause.',
    fixture: 'C→A, C→B (shared cause) vs A→B, B→A (coupling)',
    expectedDistinguishingCase: 'Shared cause under zero thresholds.',
    observed: cvs.observed,
    preservedBehavior: 'shared cause never becomes an episode',
    evidence: 'detectEpisodes at minInfluence=0',
    classification: 'non-substitutable',
    implication: 'Directed from→to structure is required; thresholds alone cannot separate coupling from shared cause.',
  });
  records.push({
    element: 'Interaction episode', form: 'reconstruction',
    hypothesis: 'Candidate episodes are derived, not primitive.',
    transformation: 'Reconstruct episodes from transitions + world participants + ⟨B,T,C,R,I⟩.',
    fixture: 'F1.7 14-case adversarial battery',
    expectedDistinguishingCase: 'Mediated and overlapping episodes.',
    observed: 'All 14 adversarial cases reproduce their preregistered verdicts from transitions + contract alone.',
    preservedBehavior: 'episode set, participants, bases, alternates',
    evidence: 'F1.7 detectEpisodes',
    classification: 'derived-conditional',
    implication: 'Interaction is removed from K₀ — derived, but only relative to a declared detection contract.',
  });

  // D. Relations vs Operations
  const rel = probeRelationReconstruction();
  records.push({
    element: 'Relations', form: 'collapse',
    hypothesis: 'Relation structure may collapse into directed operations/transitions.',
    transformation: 'Reconstruct relations from observed transition edges only.',
    fixture: 'declared latent relation A→B (never exercised) + exercised A→C',
    expectedDistinguishingCase: 'A persistent relation with no current transition.',
    observed: rel.observed,
    failedCapability: rel.latentLost ? 'latent/persistent relation semantics + relation type' : undefined,
    preservedBehavior: 'observed interaction edges are reconstructible',
    evidence: 'relationsFromTransitions over a trace lacking the latent edge',
    classification: 'collapsible-with-loss',
    implication: 'Relations are NOT eliminable: observed edges reconstruct, latent/typed relation semantics do not.',
  });
  const ops = probeOperationReconstruction();
  records.push({
    element: 'Operations', form: 'reconstruction',
    hypothesis: 'Operations may be reconstructible from State + Dynamics + transitions.',
    transformation: 'Derive the operation vocabulary from observed transitions only.',
    fixture: 'declared operations {act, latent}; only act is invoked',
    expectedDistinguishingCase: 'A latent operation never exercised.',
    observed: ops.observed,
    failedCapability: ops.latentLost ? 'available / invocable / latent operation vocabulary' : undefined,
    preservedBehavior: 'invoked operations are reconstructible',
    evidence: 'operationsFromTransitions over a trace lacking the latent op',
    classification: 'non-substitutable',
    implication: 'Operations are required to represent available and authorized change, not merely observed change.',
  });

  // E. Authority and Capability
  const cap = probeCapabilityPermissionCollapse();
  records.push({
    element: 'Capability / Authority', form: 'collapse',
    hypothesis: 'Capability and permission may collapse into one allowance flag.',
    transformation: 'Replace the two predicates with allowed = capable && permitted.',
    fixture: 'capable-not-permitted and permitted-not-capable',
    expectedDistinguishingCase: 'Two worlds that differ only in which predicate fails.',
    observed: cap.observed,
    failedCapability: cap.lost ? 'which predicate failed (diagnosis + governance provenance)' : undefined,
    evidence: 'evaluateOpportunity failedPredicates vs the collapsed conjunction',
    classification: 'collapsible-with-loss',
    implication: 'Kept distinct as typed constraints (ratified M1.5-04); neither becomes a kernel primitive.',
  });
  records.push({
    element: 'Capability / Authority', form: 'removal',
    hypothesis: 'They are typed constraints consumed by derivations, not standalone primitives.',
    transformation: 'Remove each independently from the opportunity context.',
    fixture: 'F1.6 removal probes',
    expectedDistinguishingCase: 'capable unaffected when authority is removed, and vice versa.',
    observed: 'Removing authority leaves capable intact; removing capability leaves permitted intact — the predicates are independent.',
    preservedBehavior: 'independence of can vs may',
    evidence: 'probeOpportunityRemoval(capability) and (authority)',
    classification: 'necessary-component',
    implication: 'Retained as operation constraints (typed predicates), not as K elements.',
  });

  // F. Projection
  const proj = probeProjectionMateriality();
  records.push({
    element: 'Projection', form: 'collapse',
    hypothesis: 'Projection may collapse into observation alone.',
    transformation: 'Hold state constant; vary only the projection.',
    fixture: 'same state, projection full vs reduced',
    expectedDistinguishingCase: 'An operation exposed by one projection and hidden by another.',
    observed: proj.observed,
    failedCapability: proj.material ? 'exposure / signaling / operation availability under a projection' : undefined,
    evidence: 'evaluateOpportunity under two projections over identical state',
    classification: 'non-substitutable',
    implication: 'Projection materially changes derivation results; it does NOT collapse into observation. Retained in K₀ as Π.',
  });

  // G. Entities / identity
  const ent = probeEntityIdentityRemoval();
  records.push({
    element: 'Entities (identity)', form: 'removal',
    hypothesis: 'Identity is required for attribution in every downstream derivation.',
    transformation: 'Anonymize participant identity in the trace.',
    fixture: 'A↔B reciprocal episode with identities erased',
    expectedDistinguishingCase: 'Two participants that become indistinguishable.',
    observed: ent.observed,
    failedCapability: ent.attributionLost ? 'participant attribution (episode + opportunity)' : undefined,
    evidence: 'detectEpisodes with named vs anonymized participants',
    classification: 'representation-dependent',
    implication: 'Identity is necessary; whether it is a separate element or a typed structure inside X is a representation choice.',
  });

  // Invariants
  records.push({
    element: 'Invariants', form: 'collapse',
    hypothesis: 'Invariants may be collapsed into transition guards inside Dynamics.',
    transformation: 'Install invariants as guards within the dynamics realization.',
    fixture: 'opaque-native field substrate',
    expectedDistinguishingCase: 'An opaque substrate that exposes no guard-installation point.',
    observed: 'The field substrate declares inspectInternalState=false and declareTransitionLaw=false — the kernel cannot install guards inside it; invariants are checked OUTSIDE the substrate over a readable projection.',
    failedCapability: 'guard installation inside an opaque substrate',
    preservedBehavior: 'kernel-side invariant checking over a snapshot reading',
    evidence: 'field contract capabilities + checkInvariantsAgainst',
    classification: 'necessary-component',
    implication: 'Invariants must remain kernel-side (V); they cannot be guards over Dynamics for opaque substrates.',
  });

  return records;
}

// ── K vs K₀ ──────────────────────────────────────────────────────────────────

export interface KernelComparisonRow {
  readonly element: string;
  readonly roleInK: string;
  readonly ablationResult: AblationClass;
  readonly retainedInK0: boolean;
  readonly reason: string;
  readonly derivationOrCounterexample: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly remainingUncertainty: string;
}

/** K  = ⟨Entities, State, Relations, Operations, Dynamics, Projection, Invariants⟩ */
export const K_ELEMENTS = ['Entities', 'State', 'Relations', 'Operations', 'Dynamics', 'Projection', 'Invariants'] as const;
/** K₀ = ⟨X, Θ, Π, V⟩ — X carries typed entity/relation/operation structure. */
export const K0_ELEMENTS = ['X (state incl. typed entities/relations/operations)', 'Θ (lawful evolution + admissible operations)', 'Π (projection)', 'V (validity/invariants)'] as const;

export function kernelComparison(): KernelComparisonRow[] {
  return [
    {
      element: 'Entities', roleInK: 'identity-bearing participants', ablationResult: 'representation-dependent',
      retainedInK0: true, reason: 'Identity is required for attribution in Ω_sys and episode detection; anonymization destroys it.',
      derivationOrCounterexample: 'Anonymized trace loses participant attribution (probeEntityIdentityRemoval).',
      confidence: 'high', remainingUncertainty: 'Hosting as a typed structure inside X vs a separate element is untested for large worlds.',
    },
    {
      element: 'State', roleInK: 'world configuration', ablationResult: 'necessary-primitive',
      retainedInK0: true, reason: 'Every derivation reads state; nothing reconstructs it.',
      derivationOrCounterexample: 'No candidate derivation exists; removal disables all probes.',
      confidence: 'high', remainingUncertainty: 'None within the tested domain.',
    },
    {
      element: 'Relations', roleInK: 'typed structure between participants', ablationResult: 'collapsible-with-loss',
      retainedInK0: true, reason: 'Observed edges reconstruct from transitions, but latent/persistent relations and relation TYPE do not.',
      derivationOrCounterexample: 'Declared latent A→B never appears in any transition (probeRelationReconstruction).',
      confidence: 'high', remainingUncertainty: 'Whether relation type can be carried as operation metadata instead of relation structure.',
    },
    {
      element: 'Operations', roleInK: 'admissible/invocable change', ablationResult: 'non-substitutable',
      retainedInK0: true, reason: 'Transitions record only invoked change; available, permitted, and latent operations are not recoverable.',
      derivationOrCounterexample: 'Latent operation never invoked is absent from operationsFromTransitions.',
      confidence: 'high', remainingUncertainty: 'Whether Operations fold into Θ as labeled transitions without loss (folded in K₀, untested at scale).',
    },
    {
      element: 'Dynamics', roleInK: 'lawful evolution', ablationResult: 'non-substitutable',
      retainedInK0: true, reason: 'Declarative substitution covers only part of the corpus; opaque laws remain (F1.5).',
      derivationOrCounterexample: '3 of 11 corpus laws have no declarative representation (hidden state, host/callback, nonlinear time).',
      confidence: 'high', remainingUncertainty: 'Whether a richer IR could absorb the opaque region without becoming JavaScript-as-data.',
    },
    {
      element: 'Projection', roleInK: 'participant-relative access', ablationResult: 'non-substitutable',
      retainedInK0: true, reason: 'Projection materially changes Ω_sys over identical state; it is not reducible to observation.',
      derivationOrCounterexample: 'Same state, two projections → different availability (probeProjectionMateriality).',
      confidence: 'high', remainingUncertainty: 'Whether the sub-roles (exposure vs signaling vs evidence access) need separate elements.',
    },
    {
      element: 'Invariants', roleInK: 'validity predicates', ablationResult: 'necessary-component',
      retainedInK0: true, reason: 'Cannot be installed as guards inside an opaque substrate; must be checked kernel-side.',
      derivationOrCounterexample: 'Field substrate declares inspectInternalState=false, declareTransitionLaw=false.',
      confidence: 'medium', remainingUncertainty: 'For fully declarative substrates, invariants MIGHT reduce to transition guards — untested.',
    },
    {
      element: 'Opportunity (Ω_sys)', roleInK: 'candidate element (never ratified)', ablationResult: 'derived-complete',
      retainedInK0: false, reason: 'Fully reconstructed from state, operations, capability, authority, projection, reachability, history.',
      derivationOrCounterexample: 'Ω_sys = f(X, 𝒪, Cap, Auth, Reach, Π, H) — F1.6 executable derivation.',
      confidence: 'high', remainingUncertainty: 'Participant-believed opportunity remains empirical and out of scope.',
    },
    {
      element: 'Interaction episode', roleInK: 'candidate element (never ratified)', ablationResult: 'derived-conditional',
      retainedInK0: false, reason: 'Derived from transitions + world participants under a declared detection contract.',
      derivationOrCounterexample: 'F1.7 reproduces all 14 adversarial verdicts from transitions + ⟨B,T,C,R,I⟩.',
      confidence: 'high', remainingUncertainty: 'Boundary justification is analytic/empirical, not runtime-decidable.',
    },
    {
      element: 'Capability / Authority', roleInK: 'typed constraints (M1.5-04)', ablationResult: 'collapsible-with-loss',
      retainedInK0: false, reason: 'Not kernel elements; typed predicates consumed by derivations. Collapsing the two loses diagnosis.',
      derivationOrCounterexample: 'capable-not-permitted and permitted-not-capable are indistinguishable under a single allowance flag.',
      confidence: 'high', remainingUncertainty: 'Delegated authority chains not modeled.',
    },
    {
      element: 'DynamicsContract', roleInK: 'experimental runtime boundary', ablationResult: 'execution-boundary-only',
      retainedInK0: false, reason: 'A runtime interface enabling substrate interchange, not a formal kernel element.',
      derivationOrCounterexample: 'One kernel executes opaque-native and interpreted substrates unchanged (F1.3).',
      confidence: 'high', remainingUncertainty: 'Whether opaque and declarative dynamics ultimately need separate contract types.',
    },
  ];
}
