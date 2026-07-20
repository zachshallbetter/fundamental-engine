/**
 * F2 foundation — `ProjectionContract` (EXPERIMENTAL, internal, not exported from the package entry).
 *
 * A projection is how a world is PRESENTED to a participant or consumer. It is deliberately kept
 * distinct from six neighbouring concepts that are easy to collapse:
 *
 *   observation    — what state can be read           (≠ what operations are offered)
 *   snapshot       — a serialized reading of state    (≠ a presentation of a world)
 *   evidence       — the record of what was observed  (≠ access to that record)
 *   capability     — what execution CAN occur         (a projection can never create it)
 *   authority      — what MAY occur, and by whose say (a projection can never grant it)
 *   operation availability — whether an operation can be invoked to effect NOW
 *
 * The load-bearing rule: **a projection is subtractive with respect to power**. It may hide, withhold,
 * relabel and understate; it may never manufacture a capability or silently grant permission. Where a
 * definition claims more than the source holds, the surface still reflects the SOURCE and the excess is
 * reported as an anomaly — never resolved in the projection's favour.
 *
 * A projection CAN change Ω_sys (system-relative opportunity) without changing world state, because
 * `exposed` and `signaled` are projection-relative predicates. That is the point, not a defect.
 *
 * Participant belief, perception, interpretation and understanding are NOT modelled here — they are
 * empirically inferred (M1.5-01). Where a claim would require them, an unresolved obligation is emitted.
 */
import type { WorldVersionEnvelope } from '../envelope.ts';
import type { WorldStateSnapshot } from '../world.ts';
import type { AuthorityGrant, OperationDecl, OpportunityProjection } from '../opportunity/opportunity.ts';

export interface ProjectionIdentity {
  readonly id: string;
  readonly version: string;
}

/** Who the projection is FOR. A consumer need not be a person. */
export interface ProjectionScope {
  readonly consumer: string;
  readonly kind: 'participant' | 'agent' | 'diagnostic' | 'external-system';
}

// ------------------------------------------------------------------ access, as separate concepts

/** What state may be READ. Distinct from {@link OperationExposure} — reading is not acting. */
export interface ObservationAccess {
  readonly observable: readonly string[];
  /** Present in the world, deliberately withheld from this surface. NOT the same as absent. */
  readonly hidden: readonly string[];
}

/**
 * Three genuinely different states:
 *   exposed     — offered on this surface
 *   hidden      — exists in the world, deliberately not offered here
 *   unavailable — does not exist in the world at all
 * Collapsing `hidden` into `unavailable` would let a projection misrepresent the world's vocabulary.
 */
export type OperationExposureState = 'exposed' | 'hidden' | 'unavailable';

export interface OperationExposure {
  readonly exposed: readonly string[];
  readonly hidden: readonly string[];
  /** Discoverability. A subset of `exposed`: nothing can be signaled that is not offered. */
  readonly signaled: readonly string[];
}

/** Access to the evidence record — distinct from the evidence itself. */
export interface EvidenceAccess {
  readonly accessible: readonly string[];
  readonly withheld: readonly string[];
}

/**
 * What the surface PRESENTS about permission. Presenting less than the source holds is a legitimate
 * projection choice (understatement). Presenting more is an anomaly and never takes effect.
 */
export interface AuthorityPresentation {
  readonly presented: readonly string[];
}

export interface ProjectionTransform {
  readonly id: string;
  readonly kind: 'filter' | 'rename' | 'aggregate' | 'derive' | 'redact';
  readonly detail: string;
}

/** An invariant evaluated against the SURFACE, never against hidden world state. */
export interface ProjectionInvariant {
  readonly id: string;
  readonly statement: string;
  /** Surface keys the claim reads. Anything outside the surface makes it unevaluable here. */
  readonly reads: readonly string[];
}

export interface ProjectionDefinition {
  readonly identity: ProjectionIdentity;
  readonly sourceEnvelope: WorldVersionEnvelope;
  readonly scope: ProjectionScope;
  readonly observation: ObservationAccess;
  readonly operations: OperationExposure;
  readonly evidence: EvidenceAccess;
  readonly authority: AuthorityPresentation;
  readonly invariants: readonly ProjectionInvariant[];
  readonly provenance: readonly ProjectionTransform[];
}

// ------------------------------------------------------------------------------- the source of truth

/** The ground truth a projection is taken OF. The projection never writes back to it. */
export interface ProjectionSource {
  readonly envelope: WorldVersionEnvelope;
  readonly operations: readonly OperationDecl[];
  readonly snapshot: WorldStateSnapshot;
  /** What execution can actually occur (capability, NOT permission). */
  readonly capabilities: readonly string[];
  readonly authority: readonly AuthorityGrant[];
  readonly evidenceIds: readonly string[];
}

// ------------------------------------------------------------------------------------ the result

export type ProjectionAnomalyCode =
  | 'capability-not-manufacturable'
  | 'authority-overstated'
  | 'exposed-operation-absent-from-world'
  | 'exposed-and-hidden-conflict'
  | 'signaled-without-exposure'
  | 'observation-key-absent-from-world'
  | 'envelope-mismatch';

export interface ProjectionAnomaly {
  readonly code: ProjectionAnomalyCode;
  readonly subject: string;
  readonly detail: string;
}

/** Something the runtime cannot decide. Never silently discharged. */
export interface ProjectionObligation {
  readonly id: string;
  readonly claim: string;
  readonly authority: string;
  readonly status: 'unresolved';
}

export interface OperationExposureRecord {
  readonly operation: string;
  readonly exposure: OperationExposureState;
  readonly signaled: boolean;
}

export interface ProjectionSurface {
  readonly identity: ProjectionIdentity;
  readonly sourceEnvelope: WorldVersionEnvelope;
  readonly scope: ProjectionScope;
  /** Filtered state. Hidden keys are ABSENT here while remaining present in the world. */
  readonly observedState: Readonly<Record<string, number>>;
  readonly hiddenStateKeys: readonly string[];
  readonly operations: readonly OperationExposureRecord[];
  /** Always a subset of the source's capabilities — the subtractive rule, enforced. */
  readonly effectiveCapabilities: readonly string[];
  /** Always a subset of the source's valid grants — a projection cannot grant. */
  readonly effectiveAuthority: readonly AuthorityGrant[];
  /** What the surface CLAIMS about permission; may differ from `effectiveAuthority`. */
  readonly presentedAuthority: readonly string[];
  readonly accessibleEvidence: readonly string[];
  readonly invariants: readonly ProjectionInvariant[];
  readonly provenance: readonly ProjectionTransform[];
}

export interface ProjectionResult {
  readonly surface: ProjectionSurface;
  readonly anomalies: readonly ProjectionAnomaly[];
  readonly obligations: readonly ProjectionObligation[];
}

function validGrant(g: AuthorityGrant): boolean {
  return g.authoritySource.length > 0 && g.authoritySource !== 'unknown';
}

/**
 * Apply a definition to a source. Pure: returns a surface plus every discrepancy found, and never
 * mutates or "repairs" the source in the projection's favour.
 */
export function project(definition: ProjectionDefinition, source: ProjectionSource): ProjectionResult {
  const anomalies: ProjectionAnomaly[] = [];
  const obligations: ProjectionObligation[] = [];

  if (definition.sourceEnvelope.worldInstance !== source.envelope.worldInstance) {
    anomalies.push({
      code: 'envelope-mismatch',
      subject: definition.identity.id,
      detail: `definition targets ${definition.sourceEnvelope.worldInstance}, source is ${source.envelope.worldInstance}`,
    });
  }

  // --- observation: hidden keys are removed from the surface but remain in the world snapshot
  const worldMetrics = source.snapshot.metrics;
  const hiddenSet = new Set(definition.observation.hidden);
  const observedState: Record<string, number> = {};
  for (const key of definition.observation.observable) {
    if (!(key in worldMetrics)) {
      anomalies.push({ code: 'observation-key-absent-from-world', subject: key, detail: 'observable key is not present in the source snapshot' });
      continue;
    }
    if (hiddenSet.has(key)) {
      anomalies.push({ code: 'exposed-and-hidden-conflict', subject: key, detail: 'key declared both observable and hidden' });
      continue;
    }
    observedState[key] = worldMetrics[key]!;
  }

  // --- operations: exposed / hidden / unavailable are kept genuinely distinct
  const worldOps = new Set(source.operations.map((o) => o.id));
  const exposedSet = new Set(definition.operations.exposed);
  const hiddenOps = new Set(definition.operations.hidden);
  const signaledSet = new Set(definition.operations.signaled);

  for (const op of exposedSet) {
    if (!worldOps.has(op)) {
      anomalies.push({ code: 'exposed-operation-absent-from-world', subject: op, detail: 'projection exposes an operation the world does not declare' });
    }
    if (hiddenOps.has(op)) {
      anomalies.push({ code: 'exposed-and-hidden-conflict', subject: op, detail: 'operation declared both exposed and hidden' });
    }
  }
  for (const op of signaledSet) {
    if (!exposedSet.has(op)) {
      anomalies.push({ code: 'signaled-without-exposure', subject: op, detail: 'an operation cannot be signaled without being exposed' });
    }
  }

  const allOps = new Set<string>([...worldOps, ...exposedSet, ...hiddenOps]);
  const operations: OperationExposureRecord[] = [...allOps].sort().map((op) => {
    const exposure: OperationExposureState = !worldOps.has(op)
      ? 'unavailable' // not in the world at all — distinct from being hidden
      : hiddenOps.has(op)
        ? 'hidden' // exists, deliberately not offered here
        : exposedSet.has(op)
          ? 'exposed'
          : 'hidden'; // not offered on this surface ⇒ hidden, never "unavailable"
    return { operation: op, exposure, signaled: exposure === 'exposed' && signaledSet.has(op) };
  });

  // --- capability: strictly subtractive. Exposure never creates the ability to execute.
  const effectiveCapabilities = source.capabilities.filter((c) => exposedSet.has(c));
  for (const op of exposedSet) {
    if (!source.capabilities.includes(op)) {
      anomalies.push({
        code: 'capability-not-manufacturable',
        subject: op,
        detail: 'operation is exposed but the source holds no capability for it; exposure does not create one',
      });
    }
  }

  // --- authority: presenting less is legitimate; presenting more is reported and never takes effect
  const validGrants = source.authority.filter(validGrant);
  const grantedOps = new Set(validGrants.map((g) => g.operation));
  const effectiveAuthority = validGrants.filter((g) => exposedSet.has(g.operation));
  for (const op of definition.authority.presented) {
    if (!grantedOps.has(op)) {
      anomalies.push({
        code: 'authority-overstated',
        subject: op,
        detail: 'projection presents permission the source does not grant; presentation does not confer permission',
      });
    }
  }

  // --- evidence access
  const withheld = new Set(definition.evidence.withheld);
  const accessibleEvidence = definition.evidence.accessible.filter((e) => source.evidenceIds.includes(e) && !withheld.has(e));

  // The runtime reports what is signaled; it must NOT claim the consumer perceived or understood it.
  if (signaledSet.size > 0) {
    obligations.push({
      id: `perception:${definition.identity.id}`,
      claim: 'signaled operations are perceived, understood, or expected by the consumer',
      authority: 'empirical',
      status: 'unresolved',
    });
  }

  return {
    surface: {
      identity: definition.identity,
      sourceEnvelope: source.envelope,
      scope: definition.scope,
      observedState,
      hiddenStateKeys: [...hiddenSet].filter((k) => k in worldMetrics),
      operations,
      effectiveCapabilities,
      effectiveAuthority,
      presentedAuthority: definition.authority.presented,
      accessibleEvidence,
      invariants: definition.invariants,
      provenance: definition.provenance,
    },
    anomalies,
    obligations,
  };
}

/** Bridge to Ω_sys (F1.6): the projection-relative half of opportunity, derived from the surface. */
export function toOpportunityProjection(surface: ProjectionSurface): OpportunityProjection {
  return {
    id: surface.identity.id,
    exposed: surface.operations.filter((o) => o.exposure === 'exposed').map((o) => o.operation),
    signaled: surface.operations.filter((o) => o.signaled).map((o) => o.operation),
  };
}

export type ProjectionInvariantStatus = 'satisfied' | 'violated' | 'unevaluable-outside-surface';

export interface ProjectionInvariantResult {
  readonly id: string;
  readonly status: ProjectionInvariantStatus;
  readonly reason: string;
}

/**
 * Evaluate projection-relative invariants against the SURFACE only. A claim that reads a key which is
 * not on the surface is `unevaluable-outside-surface` — it is never silently satisfied by reaching into
 * hidden world state.
 */
export function checkProjectionInvariants(
  surface: ProjectionSurface,
  predicate: (id: string, observed: Readonly<Record<string, number>>) => boolean,
): ProjectionInvariantResult[] {
  return surface.invariants.map((inv) => {
    const missing = inv.reads.filter((k) => !(k in surface.observedState));
    if (missing.length > 0) {
      return {
        id: inv.id,
        status: 'unevaluable-outside-surface' as const,
        reason: `reads ${missing.join(', ')} which are not on this surface`,
      };
    }
    return predicate(inv.id, surface.observedState)
      ? { id: inv.id, status: 'satisfied' as const, reason: 'holds against the projection surface' }
      : { id: inv.id, status: 'violated' as const, reason: 'fails against the projection surface' };
  });
}
