/**
 * F2 foundation — property classification (EXPERIMENTAL, internal, not exported from the package entry).
 *
 * Stage-2 needs to say what KIND of claim a property is before it can say whether the claim holds. Three
 * classes, with genuinely different evaluation authorities:
 *
 *   mechanically-decidable — decidable from the declaration/state by the runtime itself
 *   model-checkable        — requires exploring a space of executions, not observing one
 *   empirically-testable   — requires evidence about people, which this runtime cannot produce
 *
 * The rule that makes this honest: **an empirical property can never be marked `satisfied` here.** The
 * internal validator may only return `unresolved`, `insufficient-evidence`, or a deferral carrying a
 * reference to external empirical evidence. It must never infer belief, interpretation, usability,
 * understanding, expectation, or experience from runtime state (M1.5-01).
 *
 * The second rule: **one observed execution is not a model check.** A model-checkable claim backed only
 * by an observed run returns `insufficient-evidence`, never `satisfied` — that conflation is precisely
 * how a runtime talks itself into believing it proved something.
 */
import type { ProjectionSurface } from '../projection/projection.ts';

export type PropertyClass = 'mechanically-decidable' | 'model-checkable' | 'empirically-testable';

export type EvaluationAuthority = 'runtime' | 'model-checker' | 'external-empirical';

export type PropertyStatus =
  | 'satisfied'
  | 'violated'
  | 'unresolved'
  | 'not-applicable'
  | 'insufficient-evidence';

export type PropertyEvidenceKind =
  | 'declaration'
  | 'projection-surface'
  | 'observed-execution'
  | 'bounded-model-check'
  | 'exhaustive-exploration'
  | 'external-empirical-study';

export interface PropertyEvidence {
  readonly kind: PropertyEvidenceKind;
  readonly id: string;
  readonly detail?: string;
  /** For model-checking evidence: what portion of the space was covered. */
  readonly coverage?: string;
}

export interface PropertyProvenance {
  readonly declaredBy: string;
  readonly declaredIn: string;
}

export interface PropertyDeclaration {
  readonly id: string;
  readonly statement: string;
  readonly propertyClass: PropertyClass;
  readonly requiredEvidence: readonly PropertyEvidenceKind[];
  readonly provenance: PropertyProvenance;
  /** Surface keys the claim reads, when it is projection-relative. */
  readonly reads?: readonly string[];
  /** Evidence ids the claim depends on, when it is projection-relative. */
  readonly requiresEvidenceIds?: readonly string[];
}

export interface PropertyResult {
  readonly id: string;
  readonly propertyClass: PropertyClass;
  readonly evaluationAuthority: EvaluationAuthority;
  readonly requiredEvidence: readonly PropertyEvidenceKind[];
  readonly status: PropertyStatus;
  readonly reason: string;
  readonly provenance: PropertyProvenance;
  readonly usedEvidence: readonly PropertyEvidence[];
  /** Set only when deferring to an outside authority; never a claim that the property holds. */
  readonly externalReference?: string;
}

export function authorityFor(propertyClass: PropertyClass): EvaluationAuthority {
  switch (propertyClass) {
    case 'mechanically-decidable':
      return 'runtime';
    case 'model-checkable':
      return 'model-checker';
    case 'empirically-testable':
      return 'external-empirical';
  }
}

/**
 * Terms whose truth lives in a person, not in state. A claim using them cannot be mechanically decided
 * or model-checked no matter how it was labelled.
 */
const PARTICIPANT_INFERENCE_TERMS = [
  'believe', 'belief', 'perceive', 'perception', 'understand', 'understanding',
  'expect', 'expectation', 'experience', 'usable', 'usability', 'intuitive',
  'confusing', 'confused', 'prefer', 'satisfaction', 'trust', 'notice',
];

export function requiresParticipantInference(statement: string): boolean {
  const s = statement.toLowerCase();
  return PARTICIPANT_INFERENCE_TERMS.some((t) => s.includes(t));
}

export interface PropertyDeclarationProblem {
  readonly rule: string;
  readonly detail: string;
}

/** Static checks on the declaration itself, independent of any evidence offered. */
export function validatePropertyDeclaration(decl: PropertyDeclaration): PropertyDeclarationProblem[] {
  const problems: PropertyDeclarationProblem[] = [];

  if (decl.propertyClass !== 'empirically-testable' && requiresParticipantInference(decl.statement)) {
    problems.push({
      rule: 'participant-inference⇒empirical',
      detail: `"${decl.statement}" refers to participant state; it cannot be ${decl.propertyClass}`,
    });
  }
  if (decl.propertyClass === 'mechanically-decidable' && decl.requiredEvidence.includes('external-empirical-study')) {
    problems.push({
      rule: 'mechanical∦empirical-evidence',
      detail: 'a mechanically-decidable property must not require empirical evidence',
    });
  }
  if (decl.propertyClass === 'model-checkable' && decl.requiredEvidence.every((k) => k === 'observed-execution')) {
    problems.push({
      rule: 'model-check∦single-execution',
      detail: 'observed executions alone cannot discharge a model-checkable property',
    });
  }
  if (decl.propertyClass === 'empirically-testable' && !decl.requiredEvidence.includes('external-empirical-study')) {
    problems.push({
      rule: 'empirical⇒external-study',
      detail: 'an empirically-testable property must require external empirical evidence',
    });
  }
  return problems;
}

export interface PropertyEvaluationInput {
  readonly declaration: PropertyDeclaration;
  readonly offered: readonly PropertyEvidence[];
  /**
   * The runtime's mechanical verdict, when it has one. Supplied ONLY for mechanically-decidable
   * properties; it is ignored for the other classes by construction.
   */
  readonly mechanicalVerdict?: boolean;
}

/**
 * Evaluate one property declaration. The class dictates what conclusions are reachable — the evidence
 * cannot buy a stronger status than the class allows.
 */
export function evaluateProperty(input: PropertyEvaluationInput): PropertyResult {
  const decl = input.declaration;
  const authority = authorityFor(decl.propertyClass);
  const base = {
    id: decl.id,
    propertyClass: decl.propertyClass,
    evaluationAuthority: authority,
    requiredEvidence: decl.requiredEvidence,
    provenance: decl.provenance,
  };

  const problems = validatePropertyDeclaration(decl);
  if (problems.length > 0) {
    return {
      ...base,
      status: 'not-applicable',
      reason: `misclassified declaration: ${problems.map((p) => p.rule).join(', ')}`,
      usedEvidence: [],
    };
  }

  // --- empirical: the runtime may defer, and nothing else. It never concludes satisfied.
  if (decl.propertyClass === 'empirically-testable') {
    const study = input.offered.find((e) => e.kind === 'external-empirical-study');
    if (study) {
      return {
        ...base,
        status: 'unresolved',
        reason: 'deferred to external empirical authority; the runtime does not adjudicate empirical claims',
        usedEvidence: [study],
        externalReference: study.id,
      };
    }
    const internalOnly = input.offered.filter((e) => e.kind !== 'external-empirical-study');
    return {
      ...base,
      status: 'insufficient-evidence',
      reason:
        internalOnly.length > 0
          ? `only internal evidence offered (${internalOnly.map((e) => e.kind).join(', ')}); an empirical claim cannot be settled from runtime state`
          : 'no empirical evidence offered',
      usedEvidence: internalOnly,
    };
  }

  // --- model-checkable: exploring a space, not witnessing a run
  if (decl.propertyClass === 'model-checkable') {
    const checks = input.offered.filter((e) => e.kind === 'bounded-model-check' || e.kind === 'exhaustive-exploration');
    if (checks.length === 0) {
      const runs = input.offered.filter((e) => e.kind === 'observed-execution');
      return {
        ...base,
        status: 'insufficient-evidence',
        reason:
          runs.length > 0
            ? `${runs.length} observed execution(s) cannot generalize over the state space`
            : 'no model-checking evidence offered',
        usedEvidence: runs,
      };
    }
    const exhaustive = checks.find((e) => e.kind === 'exhaustive-exploration');
    return {
      ...base,
      status: exhaustive ? 'satisfied' : 'unresolved',
      reason: exhaustive
        ? `exhaustive exploration (${exhaustive.coverage ?? 'full space'})`
        : `bounded check only (${checks[0]!.coverage ?? 'bound unstated'}); holds within the bound, unresolved beyond it`,
      usedEvidence: checks,
    };
  }

  // --- mechanically-decidable: the runtime decides, from the declaration/surface alone
  const usable = input.offered.filter((e) => e.kind === 'declaration' || e.kind === 'projection-surface');
  if (input.mechanicalVerdict === undefined) {
    return { ...base, status: 'unresolved', reason: 'no mechanical verdict was produced', usedEvidence: usable };
  }
  return {
    ...base,
    status: input.mechanicalVerdict ? 'satisfied' : 'violated',
    reason: input.mechanicalVerdict ? 'decided mechanically from the declaration' : 'mechanically refuted',
    usedEvidence: usable,
  };
}

/**
 * Evaluate a projection-relative property against a SURFACE. Two hard limits, both enforced here rather
 * than left to the caller: a claim may not read state that is off-surface, and it may not be discharged
 * with evidence the surface does not make accessible.
 */
export function evaluateProjectionProperty(
  declaration: PropertyDeclaration,
  surface: ProjectionSurface,
  predicate?: (observed: Readonly<Record<string, number>>) => boolean,
): PropertyResult {
  const offSurface = (declaration.reads ?? []).filter((k) => !(k in surface.observedState));
  if (offSurface.length > 0) {
    return {
      id: declaration.id,
      propertyClass: declaration.propertyClass,
      evaluationAuthority: authorityFor(declaration.propertyClass),
      requiredEvidence: declaration.requiredEvidence,
      status: 'unresolved',
      reason: `reads ${offSurface.join(', ')} which this projection does not expose; hidden world state must not be consulted`,
      provenance: declaration.provenance,
      usedEvidence: [],
    };
  }

  const inaccessible = (declaration.requiresEvidenceIds ?? []).filter((id) => !surface.accessibleEvidence.includes(id));
  if (inaccessible.length > 0) {
    return {
      id: declaration.id,
      propertyClass: declaration.propertyClass,
      evaluationAuthority: authorityFor(declaration.propertyClass),
      requiredEvidence: declaration.requiredEvidence,
      status: 'insufficient-evidence',
      reason: `requires evidence not accessible on this surface: ${inaccessible.join(', ')}`,
      provenance: declaration.provenance,
      usedEvidence: [],
    };
  }

  return evaluateProperty({
    declaration,
    offered: [{ kind: 'projection-surface', id: surface.identity.id }],
    mechanicalVerdict: predicate ? predicate(surface.observedState) : undefined,
  });
}
