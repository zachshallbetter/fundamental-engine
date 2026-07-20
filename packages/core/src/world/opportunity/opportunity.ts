/**
 * F1.6 — system-relative opportunity `Ω_sys` (RUNTIME-DERIVED only). Evaluates one (participant,
 * operation, state, projection, history) context and returns per-predicate results with evidence.
 *
 * It NEVER includes belief, perceived availability, interpretation, expectation, confidence, experience,
 * or human strategy — those are empirically inferred (M1.5-01) and out of scope. Capability and authority
 * stay separate: `Capable(...)` = can execution occur; `Permitted(...)` = may it occur under governance,
 * and every permission requires an `authoritySource`. Field-free; internal; not exported.
 */
import type { WorldVersionEnvelope } from '../envelope.ts';

export interface OperationDecl {
  readonly id: string;
  readonly reversible: boolean;
  /** operation ids that recover from this one (empty ⇒ no recovery path). */
  readonly recoveryPaths: readonly string[];
}

export interface AuthorityGrant {
  readonly operation: string;
  readonly scope: string;
  /** REQUIRED provenance of the permission. Empty or 'unknown' ⇒ not a valid grant. */
  readonly authoritySource: string;
}

export interface OpportunityProjection {
  readonly id: string;
  readonly exposed: readonly string[];
  readonly signaled: readonly string[];
}

export interface OpportunityState {
  readonly enabled: readonly string[]; // operations whose current-state preconditions hold
  readonly reachableOutcomes: readonly string[];
}

export interface OpportunityWorld {
  readonly envelope: WorldVersionEnvelope;
  readonly operations: readonly OperationDecl[];
}

export interface OpportunityContext {
  readonly world: OpportunityWorld;
  readonly participant: string;
  readonly state: OpportunityState;
  readonly projection: OpportunityProjection;
  readonly history: readonly string[];
  /** operations this participant can effectively execute (capability, NOT permission). */
  readonly capabilities: readonly string[];
  readonly authority: readonly AuthorityGrant[];
}

export type PredicateName =
  | 'domain-valid'
  | 'capable'
  | 'permitted'
  | 'enabled'
  | 'reachable'
  | 'exposed'
  | 'signaled'
  | 'reversible-or-recoverable';

export type PredicateFailureReason =
  | 'unsupported-operation'
  | 'not-capable'
  | 'no-authority'
  | 'unknown-authority-source'
  | 'preconditions-unmet'
  | 'unreachable'
  | 'not-exposed'
  | 'not-signaled'
  | 'irreversible-no-recovery';

export interface PredicateFailure {
  readonly predicate: PredicateName;
  readonly reason: PredicateFailureReason;
}

export interface PredicateEvidence {
  readonly predicate: PredicateName;
  readonly value: boolean;
  readonly basis: string;
  readonly authoritySource?: string;
}

export interface OpportunityEvidence {
  /** Retains the world/version envelope so the result can be reconstructed. */
  readonly envelope: WorldVersionEnvelope;
  readonly participant: string;
  readonly operation: string;
  readonly projection: string;
  readonly historyLength: number;
  readonly predicates: readonly PredicateEvidence[];
}

export interface OpportunityResult {
  readonly operation: string;
  readonly participant: string;
  readonly domainValid: boolean;
  readonly capable: boolean;
  readonly permitted: boolean;
  readonly enabled: boolean;
  readonly reachable: boolean;
  readonly exposed: boolean;
  readonly signaled: boolean;
  readonly reversible: boolean;
  readonly recoveryPaths: readonly string[];
  /** The system-relative availability conjunction — ALWAYS accompanied by predicate-level evidence. */
  readonly available: boolean;
  readonly failedPredicates: readonly PredicateFailure[];
  readonly evidence: OpportunityEvidence;
}

function validGrant(g: AuthorityGrant): boolean {
  return g.authoritySource.length > 0 && g.authoritySource !== 'unknown';
}

export function evaluateOpportunity(context: OpportunityContext, operation: string): OpportunityResult {
  const decl = context.world.operations.find((o) => o.id === operation);
  const domainValid = decl !== undefined;

  const capable = context.capabilities.includes(operation);

  const grants = context.authority.filter((g) => g.operation === operation);
  const validGrants = grants.filter(validGrant);
  const permitted = validGrants.length > 0;
  const hasUnknownSourceGrant = grants.length > 0 && validGrants.length === 0;

  const enabled = context.state.enabled.includes(operation);
  const reachable = context.state.reachableOutcomes.includes(operation);
  const exposed = context.projection.exposed.includes(operation);
  const signaled = context.projection.signaled.includes(operation);
  const reversible = decl?.reversible ?? false;
  const recoveryPaths = decl?.recoveryPaths ?? [];
  const reversibleOrRecoverable = reversible || recoveryPaths.length > 0;

  const failedPredicates: PredicateFailure[] = [];
  if (!domainValid) failedPredicates.push({ predicate: 'domain-valid', reason: 'unsupported-operation' });
  if (!capable) failedPredicates.push({ predicate: 'capable', reason: 'not-capable' });
  if (!permitted) failedPredicates.push({ predicate: 'permitted', reason: hasUnknownSourceGrant ? 'unknown-authority-source' : 'no-authority' });
  if (!enabled) failedPredicates.push({ predicate: 'enabled', reason: 'preconditions-unmet' });
  if (!reachable) failedPredicates.push({ predicate: 'reachable', reason: 'unreachable' });
  if (!exposed) failedPredicates.push({ predicate: 'exposed', reason: 'not-exposed' });
  if (!signaled) failedPredicates.push({ predicate: 'signaled', reason: 'not-signaled' });
  if (!reversibleOrRecoverable) failedPredicates.push({ predicate: 'reversible-or-recoverable', reason: 'irreversible-no-recovery' });

  const authoritySource = validGrants[0]?.authoritySource ?? (hasUnknownSourceGrant ? grants[0]?.authoritySource : undefined);

  const predicates: PredicateEvidence[] = [
    { predicate: 'domain-valid', value: domainValid, basis: `operation ${domainValid ? 'in' : 'not in'} world vocabulary` },
    { predicate: 'capable', value: capable, basis: `participant ${context.participant} capabilities` },
    { predicate: 'permitted', value: permitted, basis: `${validGrants.length} valid grant(s) of ${grants.length}`, authoritySource },
    { predicate: 'enabled', value: enabled, basis: `preconditions under state (history len ${context.history.length})` },
    { predicate: 'reachable', value: reachable, basis: 'reachable outcomes' },
    { predicate: 'exposed', value: exposed, basis: `projection ${context.projection.id}` },
    { predicate: 'signaled', value: signaled, basis: `projection ${context.projection.id}` },
    { predicate: 'reversible-or-recoverable', value: reversibleOrRecoverable, basis: `reversible=${reversible}, recovery=${recoveryPaths.length}` },
  ];

  // system-relative availability: can be invoked to effect NOW. (signaled = discoverability, reported
  // separately; reversibility = a safety property, reported separately.)
  const available = domainValid && capable && permitted && enabled && reachable && exposed;

  return {
    operation,
    participant: context.participant,
    domainValid, capable, permitted, enabled, reachable, exposed, signaled, reversible,
    recoveryPaths,
    available,
    failedPredicates,
    evidence: {
      envelope: context.world.envelope,
      participant: context.participant,
      operation,
      projection: context.projection.id,
      historyLength: context.history.length,
      predicates,
    },
  };
}
