/**
 * F1.0 — World version envelope (M1.5-07, ratified 2026-07-19).
 *
 * Eight independently-addressable version identities travel with every serialized world and trace.
 * A single `version` string is insufficient (the layers evolve independently). Incompatible loads
 * FAIL EXPLICITLY — there is no silent migration in Stage 1 (migration *tooling* is Stage 4 / F4.4;
 * this module fixes version *identity* only).
 *
 * EXPERIMENTAL. Not exported from the package entry (`index.ts`); part of the world-substrate
 * program's F1 kernel experiment. See docs/planning/world-substrate/F1-execution-spec.md.
 */
import { FIELD_VERSION } from '../version.ts';

export interface WorldVersionEnvelope {
  /** Which running world this is. */
  readonly worldInstance: string;
  /** Shape of this world's declared state / ontology. */
  readonly worldSchema: string;
  /** The K semantics that evolve it. */
  readonly kernelSemantics: string;
  /** Shape of the contracts in force. */
  readonly contractSchema: string;
  /** The projection(s) that produced any accompanying representation. */
  readonly projectionContract: string;
  /** Engine build + plane, e.g. `js@0.9.4`. */
  readonly implementation: string;
  /** Version of the golden vectors this was checked against. */
  readonly conformanceVector: string;
  /** Ordered history of schema migrations applied (identity only in F1; tooling in F4.4). */
  readonly migrationChain: readonly string[];
}

export const WORLD_SCHEMA_VERSION = '0.1.0';
export const KERNEL_SEMANTICS_VERSION = '0.1.0';
export const CONTRACT_SCHEMA_VERSION = '0.1.0';
export const PROJECTION_CONTRACT_VERSION = '0.1.0';
export const CONFORMANCE_VECTOR_VERSION = '0.1.0';

/** The seven single-identity fields. `migrationChain` is compared as an ordered list, not a scalar. */
export const WORLD_ENVELOPE_IDENTITY_FIELDS = [
  'worldInstance',
  'worldSchema',
  'kernelSemantics',
  'contractSchema',
  'projectionContract',
  'implementation',
  'conformanceVector',
] as const;

export type WorldEnvelopeIdentityField = (typeof WORLD_ENVELOPE_IDENTITY_FIELDS)[number];

export interface EnvelopeMismatch {
  readonly field: WorldEnvelopeIdentityField | 'migrationChain';
  readonly expected: string;
  readonly actual: string;
}

/** Thrown when a loaded world/trace envelope is not identical to the current runtime's. */
export class IncompatibleWorldVersion extends Error {
  readonly mismatches: readonly EnvelopeMismatch[];
  constructor(mismatches: readonly EnvelopeMismatch[]) {
    const first = mismatches[0];
    super(
      `Incompatible world version: ${mismatches.length} field(s) differ` +
        (first ? ` (e.g. ${first.field}: expected "${first.expected}", got "${first.actual}")` : '') +
        '. No silent migration — resolve explicitly (migration tooling is Stage 4 / F4.4).',
    );
    this.name = 'IncompatibleWorldVersion';
    this.mismatches = mismatches;
  }
}

/** Build an envelope for `worldInstance`, defaulting each layer to its current version. */
export function createWorldEnvelope(
  worldInstance: string,
  overrides: Partial<Omit<WorldVersionEnvelope, 'worldInstance'>> = {},
): WorldVersionEnvelope {
  return {
    worldInstance,
    worldSchema: overrides.worldSchema ?? WORLD_SCHEMA_VERSION,
    kernelSemantics: overrides.kernelSemantics ?? KERNEL_SEMANTICS_VERSION,
    contractSchema: overrides.contractSchema ?? CONTRACT_SCHEMA_VERSION,
    projectionContract: overrides.projectionContract ?? PROJECTION_CONTRACT_VERSION,
    implementation: overrides.implementation ?? `js@${FIELD_VERSION}`,
    conformanceVector: overrides.conformanceVector ?? CONFORMANCE_VECTOR_VERSION,
    migrationChain: overrides.migrationChain ? [...overrides.migrationChain] : [],
  };
}

/** Every field on which `loaded` differs from `current`. Empty ⇒ compatible. */
export function envelopeMismatches(
  loaded: WorldVersionEnvelope,
  current: WorldVersionEnvelope,
): EnvelopeMismatch[] {
  const out: EnvelopeMismatch[] = [];
  for (const field of WORLD_ENVELOPE_IDENTITY_FIELDS) {
    if (loaded[field] !== current[field]) {
      out.push({ field, expected: current[field], actual: loaded[field] });
    }
  }
  const a = loaded.migrationChain;
  const b = current.migrationChain;
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    out.push({ field: 'migrationChain', expected: b.join('>'), actual: a.join('>') });
  }
  return out;
}

export function isCompatibleEnvelope(
  loaded: WorldVersionEnvelope,
  current: WorldVersionEnvelope,
): boolean {
  return envelopeMismatches(loaded, current).length === 0;
}

/** Throw {@link IncompatibleWorldVersion} unless `loaded` is identical to `current`. No silent migration. */
export function assertCompatibleEnvelope(
  loaded: WorldVersionEnvelope,
  current: WorldVersionEnvelope,
): void {
  const mismatches = envelopeMismatches(loaded, current);
  if (mismatches.length > 0) throw new IncompatibleWorldVersion(mismatches);
}
