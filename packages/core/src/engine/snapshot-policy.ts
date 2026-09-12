// Snapshot / query disclosure policy — the three pure helpers that decide what a READER of the field
// is allowed to see. Extracted verbatim from `engine/field.ts` (#994, behavior-preserving): they are
// module-level and closure-free, so they were never part of `createField`'s state and read better as
// their own seam. Pure and type-only-dependent — no runtime import, nothing field-specific.
//
// INTERNAL. Not exported from the package surface; `createField` is still the one public entry.

import type { FieldPolicy, FieldSnapshotOptions, SnapshotProfile } from './types.ts';

/** Deep-copy a {@link FieldPolicy} (shallow is unsafe — `budgets` is nested). `undefined` → `{}` (the
 *  unbounded default). Used on set + read so callers can neither mutate the field's live policy nor
 *  observe later mutations of the object they passed in. */
export function clonePolicy(p: FieldPolicy | undefined): FieldPolicy {
  if (!p) return {};
  const out: FieldPolicy = {};
  if (p.allowBodyDataInSnapshots != null) out.allowBodyDataInSnapshots = p.allowBodyDataInSnapshots;
  if (p.allowMotionProjection != null) out.allowMotionProjection = p.allowMotionProjection;
  if (p.maxMotionBudget != null) out.maxMotionBudget = p.maxMotionBudget;
  if (p.budgets) out.budgets = { ...p.budgets };
  return out;
}

/** Concrete inclusion flags a snapshot resolves to. */
export interface ResolvedSnapshotInclusion {
  includeParticles: boolean;
  includeRelationships: boolean;
  includeData: boolean;
  includeInfluences: boolean;
}

/**
 * Resolve {@link FieldSnapshotOptions} — an optional {@link SnapshotProfile} composed with the explicit
 * `include*` flags — to concrete inclusion, TIGHTEST-wins. A profile establishes a baseline; an explicit
 * flag may tighten it further but never widen it (an explicit `true` cannot re-enable what the profile
 * turned off). `includeData` additionally passes through the policy gate at the call site (this only
 * governs whether the CALLER asked for it). Relationships default true when nothing narrows them.
 */
export function resolveSnapshotInclusion(opts: FieldSnapshotOptions): ResolvedSnapshotInclusion {
  // Per-profile baselines. `debug` = everything; `agent` = structure + attribution, no opaque data;
  // `bug-report` = structural + versions, no data; `public` = ids + shape only.
  const base: Record<SnapshotProfile, ResolvedSnapshotInclusion> = {
    debug: { includeParticles: true, includeRelationships: true, includeData: true, includeInfluences: true },
    agent: { includeParticles: false, includeRelationships: true, includeData: false, includeInfluences: true },
    'bug-report': { includeParticles: false, includeRelationships: true, includeData: false, includeInfluences: true },
    public: { includeParticles: false, includeRelationships: false, includeData: false, includeInfluences: false },
  };
  const p = opts.profile;
  if (!p) {
    // No profile: today's defaults — relationships default true, the rest default false.
    return {
      includeParticles: opts.includeParticles === true,
      includeRelationships: opts.includeRelationships !== false,
      includeData: opts.includeData === true,
      includeInfluences: opts.includeInfluences === true,
    };
  }
  const b = base[p];
  // TIGHTEST wins: a flag is on only if the profile allows it AND the caller didn't explicitly turn it
  // off. An explicit `true` can never widen past the profile's baseline.
  return {
    includeParticles: b.includeParticles && opts.includeParticles !== false,
    includeRelationships: b.includeRelationships && opts.includeRelationships !== false,
    includeData: b.includeData && opts.includeData !== false,
    includeInfluences: b.includeInfluences && opts.includeInfluences !== false,
  };
}

/**
 * Strip a set of dotted `redactions` paths from a plain reading (query result or snapshot). A top-level
 * key (`'metrics'`, `'relationships'`) deletes that key from the object. A `<prefix>.<key>` path where
 * prefix ∈ {body, relationship, influence, projection} strips `<key>` from each entry of the matching
 * list; `body.data` strips per-body `data`. Mutates the passed object (it's always a fresh result/copy).
 */
export function applyRedactions<T extends Record<string, unknown>>(reading: T, redactions: readonly string[]): T {
  const listKeyFor: Record<string, string> = { body: 'bodies', relationship: 'relationships', influence: 'influences', projection: 'projections' };
  for (const path of redactions) {
    const dot = path.indexOf('.');
    if (dot < 0) {
      delete (reading as Record<string, unknown>)[path];
      continue;
    }
    const prefix = path.slice(0, dot);
    const key = path.slice(dot + 1);
    const listKey = listKeyFor[prefix];
    if (listKey && Array.isArray((reading as Record<string, unknown>)[listKey])) {
      for (const entry of (reading as Record<string, unknown>)[listKey] as Record<string, unknown>[]) {
        if (entry && typeof entry === 'object') delete entry[key];
      }
    } else if (prefix === 'metrics' && reading['metrics'] && typeof reading['metrics'] === 'object') {
      delete (reading['metrics'] as Record<string, unknown>)[key];
    } else {
      // an unrecognized prefix addresses a nested top-level object key.
      const target = (reading as Record<string, unknown>)[prefix];
      if (target && typeof target === 'object') delete (target as Record<string, unknown>)[key];
    }
  }
  return reading;
}
