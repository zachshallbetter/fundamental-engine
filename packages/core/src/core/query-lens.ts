// Query lenses (substrate query phase 2): a lens is a user-defined, declarative scope over a query
// reading — it filters which metrics, influence channels, and bodies are reported, and tags the result
// with the lens id. It is NOT an opinionated preset catalog; the caller supplies the lens. `applyLens`
// is pure (returns a new result; never mutates), so it composes over a live `query()` answer or any
// FieldQueryResult-shaped value. Read-only w.r.t. the field. EXPERIMENTAL.

import type { FieldLens, FieldQueryResult } from './types.ts';

const pick = (m: Record<string, number>, keep: ReadonlySet<string> | null): Record<string, number> =>
  keep ? Object.fromEntries(Object.entries(m).filter(([k]) => keep.has(k))) : m;

/** Scope a query result through a lens — keep only the lens's metrics / influence channels / body
 *  tokens (each clause is an allow-list; an omitted clause keeps everything in that dimension). Returns
 *  a new result tagged with `lens: lens.id`; the input is not mutated. */
export function applyLens(result: FieldQueryResult, lens: FieldLens): FieldQueryResult {
  const metricKeys = lens.metrics ? new Set(lens.metrics) : null;
  const channelKeys = lens.channels ? new Set<string>(lens.channels) : null;
  const tokenKeys = lens.tokens ? new Set<string>(lens.tokens) : null;
  return {
    ...result,
    metrics: pick(result.metrics, metricKeys),
    bodies: result.bodies
      .filter((b) => !tokenKeys || b.tokens.some((t) => tokenKeys.has(t)))
      .map((b) => ({ ...b, metrics: pick(b.metrics, metricKeys), dimensions: pick(b.dimensions, metricKeys) })),
    influences: channelKeys ? result.influences.filter((i) => channelKeys.has(i.channel ?? 'linear')) : result.influences,
    lens: lens.id,
  };
}
