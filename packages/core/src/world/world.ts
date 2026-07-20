/**
 * Generic declarative world (A′, F1.1c). A `World` is the representation-independent declaration of
 * what exists and relates — NO knowledge of fields, forces, particles, tokens-as-physics, or the DOM.
 * Its lawful evolution lives behind a {@link DynamicsContract} (see `./dynamics.ts`), which the kernel
 * executes but does not understand.
 *
 * Finding (F1.1): a `CompiledPattern` is NOT a complete world declaration — its lawful evolution exists
 * only as executable force code. So `World` carries the representable subset (entities, relations,
 * invariants, projections, identity, state) as data; evolution is delegated to a contract.
 *
 * EXPERIMENTAL. Not exported from the package entry. Must remain field-free (enforced by
 * `world/architecture.test.ts`).
 */
import type { WorldVersionEnvelope } from './envelope.ts';

export interface EntityIdentity {
  readonly id: string;
  readonly namespace?: string;
  readonly kind?: string;
  readonly host?: string;
}

export type ParamValue = number | string | boolean;

/** A declared participant in the world: a stable identity, opaque behavior tokens, and typed params. */
export interface WorldEntity {
  readonly identity: EntityIdentity;
  /** Behavior tokens — opaque *names* to the kernel; their meaning lives in the dynamics substrate. */
  readonly tokens: readonly string[];
  readonly params: Readonly<Record<string, ParamValue>>;
}

export interface WorldRelation {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly strength?: number;
}

export interface WorldInvariant {
  readonly id: string;
  /** Generic invariant kind the kernel can check against a snapshot: `count` | `range`. */
  readonly kind: string;
  readonly spec: Readonly<Record<string, ParamValue>>;
}

export interface WorldProjection {
  readonly id: string;
  /** Generic surface label (e.g. `underlay` / `overlay` / `feedback`) — NOT the field render taxonomy. */
  readonly surface: string;
  readonly declares: readonly string[];
}

export interface EntityStateReading {
  readonly id: string;
  readonly position?: { readonly x: number; readonly y: number; readonly z?: number };
  readonly metrics?: Readonly<Record<string, number>>;
}

/** A read-only, serializable projection of world state — the only window the kernel has into an
 *  opaque dynamics substrate. */
export interface WorldStateSnapshot {
  readonly envelope: WorldVersionEnvelope;
  readonly step: number;
  readonly entities: readonly EntityStateReading[];
  readonly metrics: Readonly<Record<string, number>>;
}

/** A generic declarative world. Evolution is NOT part of the declaration — it is bound as a
 *  {@link DynamicsContract} when the world is hosted. */
export interface World {
  readonly envelope: WorldVersionEnvelope;
  readonly entities: readonly WorldEntity[];
  readonly relations: readonly WorldRelation[];
  readonly invariants: readonly WorldInvariant[];
  readonly projections: readonly WorldProjection[];
}
