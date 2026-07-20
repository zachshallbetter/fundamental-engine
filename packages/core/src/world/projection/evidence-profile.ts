/**
 * Projection evidence profile (EXPERIMENTAL, internal).
 *
 * `ProjectionContract` currently carries more explanatory weight than any other Stage-2 concept, and
 * its claims are NOT equally supported. This file grades each one, because a clean API plus a passing
 * fixture reads exactly like evidence while often being neither.
 *
 * The grade that matters is the middle one:
 *
 *   experimentally-grounded  — supported by a result produced by an INDEPENDENTLY built component,
 *                              or by an ablation that changed an outcome
 *   fixture-supported        — a test I wrote passes against an API I designed. This is a consistency
 *                              check, not evidence. It cannot falsify the design it was written from
 *   architectural-hypothesis — asserted by the design, untested. Currently indistinguishable from
 *                              a good guess
 *
 * Most projection fixtures are `fixture-supported`. Saying so is the point: Stage 1 treated Opportunity
 * this way and it is why `Ω_sys` is trustworthy now.
 */
import type { PredictionId } from '../conformance/predictions.ts';

export type EvidenceGrade = 'experimentally-grounded' | 'fixture-supported' | 'architectural-hypothesis';

export interface ProjectionClaim {
  readonly id: string;
  readonly claim: string;
  readonly grade: EvidenceGrade;
  readonly basis: string;
  /** The experiment that would move this claim up a grade. Every ungrounded claim must name one. */
  readonly wouldBeGroundedBy: string;
  /** The registered prediction that will test it, once one exists. */
  readonly prediction?: PredictionId;
}

export function projectionClaims(): ProjectionClaim[] {
  return [
    {
      id: 'existence',
      claim: 'projection is not observation — it is a distinct concept',
      grade: 'experimentally-grounded',
      basis:
        'F1.8 ablation: substituting observation for projection materially changed Ω_sys over identical state. The Ω_sys evaluator was built independently, in F1.6, before ProjectionContract existed — so it could have failed to show a difference',
      wouldBeGroundedBy: 'already grounded; replication with a second opportunity model would strengthen it',
    },
    {
      id: 'omega-coupling',
      claim: 'a projection changes Ω_sys without changing world state',
      grade: 'experimentally-grounded',
      basis: 'two surfaces over one identical snapshot produced different `signaled` and identical `available`, measured through the F1.6 evaluator rather than through projection code',
      wouldBeGroundedBy: 'already grounded',
    },
    {
      id: 'boundary',
      claim: 'hidden state remains in the world but is absent from the surface, and cannot be reached through it',
      grade: 'fixture-supported',
      basis: 'projection-relative invariants reading hidden state return unevaluable-outside-surface — but the check and the surface were designed together',
      wouldBeGroundedBy:
        'an adversarial probe written against the surface WITHOUT knowledge of its implementation, attempting to recover a hidden value through any exposed path (evidence, invariants, anomalies, operation records)',
    },
    {
      id: 'power-restriction',
      claim: 'a projection cannot manufacture capability or silently grant permission',
      grade: 'fixture-supported',
      basis:
        'exposure never adds to effectiveCapabilities and presentation never adds to effectiveAuthority — proven only for the definitions I wrote, over a single projection layer',
      wouldBeGroundedBy: 'projection composition: whether the guarantee survives projecting a projection, where a second layer might launder what the first withheld',
      prediction: 'P-006',
    },
    {
      id: 'authority-presentation',
      claim: 'presented authority is fully separable from effective authority, including delegation',
      grade: 'architectural-hypothesis',
      basis: 'only understatement and overstatement over direct grants have been exercised; delegated and derived authority are untested',
      wouldBeGroundedBy: 'a substrate or scenario with real delegated authority, where the grant chain has more than one link',
      prediction: 'P-005',
    },
    {
      id: 'evidence-visibility',
      claim: 'evidence access is a projection-relative property that composes correctly',
      grade: 'architectural-hypothesis',
      basis: 'accessible/withheld is honoured for one projection over one source; nothing tests chained access or provenance survival',
      wouldBeGroundedBy: 'chained projections where the second layer requests evidence the first withheld',
      prediction: 'P-006',
    },
    {
      id: 'participant-relative-state',
      claim: 'participant-relative state needs no participant model — it reduces to observation access plus scope',
      grade: 'architectural-hypothesis',
      basis: 'scope is currently a label carried through the surface; no result depends on it',
      wouldBeGroundedBy: 'a scenario where two participants share a projection definition but must see different state, forcing scope to do real work',
      prediction: 'P-007',
    },
    {
      id: 'invariant-scope',
      claim: 'projection-relative invariants are correctly scoped to the surface',
      grade: 'architectural-hypothesis',
      basis:
        'unevaluable-outside-surface is enforced, but the foundation does not distinguish unevaluable from vacuously satisfied — a claim over an empty surface is currently indistinguishable from one that genuinely holds',
      wouldBeGroundedBy: 'invariants over surfaces that expose none of the keys they read, checked against a model that knows the true answer',
      prediction: 'P-008',
    },
  ];
}

export interface EvidenceProfile {
  readonly grounded: number;
  readonly fixtureSupported: number;
  readonly hypotheses: number;
  /** Ratio of claims backed by something that could have come out otherwise. */
  readonly groundedFraction: number;
  /** Every ungrounded claim names the experiment that would ground it. */
  readonly allUngroundedHaveAPath: boolean;
}

export function projectionEvidenceProfile(): EvidenceProfile {
  const claims = projectionClaims();
  const by = (g: EvidenceGrade) => claims.filter((c) => c.grade === g).length;
  const ungrounded = claims.filter((c) => c.grade !== 'experimentally-grounded');
  return {
    grounded: by('experimentally-grounded'),
    fixtureSupported: by('fixture-supported'),
    hypotheses: by('architectural-hypothesis'),
    groundedFraction: by('experimentally-grounded') / claims.length,
    allUngroundedHaveAPath: ungrounded.every((c) => c.wouldBeGroundedBy.length > 0),
  };
}
