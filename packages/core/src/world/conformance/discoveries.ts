/**
 * Discovery registry (EXPERIMENTAL, internal).
 *
 * A **discovery** is a concept the contract was missing, found because a substrate could not be
 * expressed without it. Discoveries get permanent identifiers because they are the empirical record of
 * how this theory changed — and unlike a changelog entry, an identifier survives refactoring, renaming
 * and rewriting.
 *
 * The registry exists to make one property auditable: **the contract is only ever allowed to change
 * because reality demanded it.** There is deliberately no procedure anywhere in this program called
 * "design a better contract". A discovery must name the substrate that forced it and the reason the
 * prior contract was incoherent or incomplete — not merely improvable.
 *
 * A `representational` refinement is NOT a discovery. It expresses an existing concept better; it finds
 * nothing. Recording it separately keeps the discovery count honest.
 */
import type { ContractChange } from './corpus.ts';
import type { EvidenceProvenance } from './evidence.ts';

export type DiscoveryId = `D-${string}`;

export interface Discovery {
  readonly id: DiscoveryId;
  readonly concept: string;
  /** The substrate whose adaptation made the gap visible. */
  readonly discoveredBy: string;
  /** Why the PRIOR contract was wrong — incoherent or incomplete, not merely improvable. */
  readonly reason: string;
  /** Why no existing substrate could have revealed it. This is what makes it a discovery. */
  readonly invisibleBecause: string;
  readonly accepted: string;
  /** Where the evidence came from. A discovery must not rest on an architectural argument. */
  readonly provenance: EvidenceProvenance;
  /** The contract changes this discovery cost. A discovery may cost more than one change. */
  readonly changes: readonly ContractChange[];
  /** Concepts deliberately NOT added at the same time, and why. Guards against over-generalizing. */
  readonly deliberatelyExcluded?: readonly string[];
}

/**
 * Every accepted structural refinement, in discovery order. Identifiers are permanent: an entry may be
 * superseded or corrected, never renumbered or removed.
 */
export function discoveries(): Discovery[] {
  return [
    {
      id: 'D-001',
      concept: 'transition-law retrieval',
      discoveredBy: 'QualityGovernor',
      reason:
        'a capability that cannot be exercised is incoherent: `declareTransitionLaw` could be set truthfully while the contract offered no way to obtain the law',
      invisibleBecause:
        'the only prior substrate (FieldRuntime) is opaque-native and declares the capability false, so the unusable branch was never taken',
      accepted: '2026-07-19',
      provenance: 'revealed-by-independent-substrate',
      changes: [
        {
          member: 'describeTransitionLaw()',
          churnClass: 'optional-member',
          classification: 'structural',
          rationale: 'the capability must be exercisable, or it asserts something the contract cannot honour',
        },
        {
          member: 'declareTransitionLaw <-> describeTransitionLaw',
          churnClass: 'consistency-rule',
          classification: 'structural',
          rationale: 'capability and accessor must agree in both directions, so neither can be claimed silently',
        },
      ],
      deliberatelyExcluded: [
        'TransitionLawDescription.completeness — rejected as a convenience when the planner wanted to publish a partial law',
      ],
    },
    {
      id: 'D-002',
      concept: 'termination',
      discoveredBy: 'FiniteStateMachine',
      reason:
        'the contract could not express termination without leaking substrate semantics: a kernel could only learn a substrate was finished by reading substrate-specific output, which is the abstraction leak the contract exists to prevent',
      invisibleBecause:
        'neither prior substrate ever finishes — a field simulates indefinitely and a governor consumes frames indefinitely — so termination was not absent from the contract, it was unobservable',
      accepted: '2026-07-19',
      provenance: 'revealed-by-independent-substrate',
      changes: [
        {
          member: 'Transition.lifecycle',
          churnClass: 'optional-member',
          classification: 'structural',
          rationale: 'a substrate must be able to say that no further transition is defined, generically',
        },
      ],
      deliberatelyExcluded: [
        'the finished-with-result vs finished-without split (goal-reached vs exhausted) — both corpus substrates exhibit it, but the evidence only forces "must the kernel keep going?"',
        'folding lifecycle into advance\'s result shape — better long-term design, deferred to avoid perturbing the F1.4 equivalence authority mid-program',
      ],
    },
  ];
}

export interface DiscoveryLedger {
  readonly count: number;
  readonly bySubstrate: Readonly<Record<string, number>>;
  readonly totalChanges: number;
  readonly exclusionsRecorded: number;
}

export function discoveryLedger(): DiscoveryLedger {
  const all = discoveries();
  const bySubstrate: Record<string, number> = {};
  for (const d of all) bySubstrate[d.discoveredBy] = (bySubstrate[d.discoveredBy] ?? 0) + 1;
  return {
    count: all.length,
    bySubstrate,
    totalChanges: all.reduce((n, d) => n + d.changes.length, 0),
    exclusionsRecorded: all.reduce((n, d) => n + (d.deliberatelyExcluded?.length ?? 0), 0),
  };
}

export function discoveryById(id: DiscoveryId): Discovery | undefined {
  return discoveries().find((d) => d.id === id);
}
