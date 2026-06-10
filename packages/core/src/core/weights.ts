/**
 * Weight primitives — the page-weight → body-strength contract made one definition.
 *
 * Every page in the example family computes the same two numbers by hand:
 *
 *   1. **A weight** — a positive magnitude (citations, market cap, message count) log-normalized
 *      against the set's max into `0..1`: `ln(x+1) / ln(max+1)`. The log is the family's standard
 *      "consensus" shape — heavy-tailed data (one work with 6,046 citations next to one with 12)
 *      compresses into a legible range while zero stays exactly zero and the max reads exactly one.
 *   2. **A strength** — that weight mapped onto the engine's attract-body range for the
 *      `data-strength` attribute: `0.4 + w · 1.6`, i.e. `w ∈ 0..1 → strength ∈ 0.4..2.0`. The floor
 *      keeps even the lightest body *present* in the field (strength 0 would make it inert); the
 *      ceiling is the range the example family's attract bodies were tuned in.
 *
 * That pair IS the contract between page weights and engine body strengths, and it was hand-rolled
 * at ~38 call sites — drift-prone magic numbers. These primitives are the extraction (the same
 * ratchet as `temporal.ts`, the sibling module): pure, deterministic maps — zero DOM, zero state.
 * Degenerate inputs (NaN, ±Infinity, negative magnitudes, `max ≤ 0`) never produce NaN — each
 * function documents its safe value.
 *
 * Equivalences for callers replacing the hand-rolls (the wave-2 spec):
 *
 *   - `logNormalize(x, max)` `===` `Math.log(x + 1) / Math.log(max + 1)` for finite `x ≥ 0` and
 *     finite `max > 0` with `x ≤ max` — bit-for-bit, no epsilon (same expression, then clamped).
 *     The evidence page's `Math.max(...counts, 1)` guard on the max is subsumed by the `max ≤ 0 → 0`
 *     rule for integer counts: all-zero counts produce all-zero weights either way.
 *   - `el.dataset.strength = (0.4 + w * 1.6).toFixed(2)` becomes
 *     `el.dataset.strength = weightToStrength(w).toFixed(2)` — the function returns the number;
 *     the two-decimal formatting stays at the attribute write.
 */

/**
 * The `data-strength` floor: `weightToStrength(0)` — the lightest body's strength. A zero-weight
 * body still participates in the field; it is light, not absent.
 */
export const WEIGHT_STRENGTH_BASE = 0.4;

/**
 * The `data-strength` span: `weightToStrength(1) − weightToStrength(0)`. Base + span = `2.0`,
 * the heaviest attract strength the example family uses.
 */
export const WEIGHT_STRENGTH_SPAN = 1.6;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Log-normalize a positive magnitude against the set's max:
 *
 *     weight = clamp01( ln(value + 1) / ln(max + 1) )
 *
 * The family's standard "consensus" shape — heavy tails compress (a 500× citation gap reads as a
 * legible weight gap, not a 500× one), zero stays exactly `0`, and `value === max` reads exactly
 * `1`. Monotonically non-decreasing in `value` for a fixed `max > 0`.
 *
 * For finite `value ≥ 0` and finite `max > 0` with `value ≤ max` this is bit-for-bit
 * `Math.log(value + 1) / Math.log(max + 1)` — the exact expression the example pages hand-roll.
 *
 * Degenerate inputs: `max ≤ 0` (or non-finite) returns `0` for every value — no max, no scale;
 * a negative, NaN, or `-Infinity` value reads as `0`; a value above the max (`+Infinity`
 * included) clamps to `1` — live updates can briefly outrun a stale max; re-normalize via
 * {@link logNormalizeAll}.
 */
export function logNormalize(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const v = value > 0 ? value : 0; // NaN/negatives/−Infinity read as 0; +Infinity clamps below
  return clamp01(Math.log(v + 1) / Math.log(max + 1));
}

/**
 * {@link logNormalize} over a whole set in one pass: weights are index-aligned with `values`,
 * each normalized against the set's own max (negative/NaN entries read as `0`, exactly as in
 * `logNormalize`). The max is returned too — live pages keep it and re-normalize incoming
 * single values against it between full passes.
 *
 * An empty set, or one with no positive finite value, returns `{ weights: [0, …], max: 0 }`
 * (all-zero counts produce all-zero weights — the same result as the pages'
 * `Math.max(...counts, 1)` guard). Otherwise the largest entry's weight is exactly `1`.
 */
export function logNormalizeAll(values: readonly number[]): { weights: number[]; max: number } {
  let max = 0;
  for (const v of values) if (Number.isFinite(v) && v > max) max = v;
  return { weights: values.map((v) => logNormalize(v, max)), max };
}

/**
 * The page-weight → engine-strength contract:
 *
 *     strength = WEIGHT_STRENGTH_BASE + w · WEIGHT_STRENGTH_SPAN    (= 0.4 + w · 1.6)
 *
 * so `w ∈ 0..1 → strength ∈ 0.4..2.0` — the attract-body range every example uses for
 * `data-strength`. The constants are exported so the mapping has ONE definition; the endpoints
 * are exact: `weightToStrength(0) === 0.4`, `weightToStrength(1) === 2.0`. Monotonically
 * increasing in `w`.
 *
 * Returns the number; callers `.toFixed(2)` at the attribute write
 * (`el.dataset.strength = weightToStrength(w).toFixed(2)`).
 *
 * Degenerate inputs: `w` outside `0..1` clamps to the endpoints (±Infinity included); NaN reads
 * as `0` — an unknown weight is a light body, not a NaN attribute.
 */
export function weightToStrength(w: number): number {
  return WEIGHT_STRENGTH_BASE + clamp01(Number.isNaN(w) ? 0 : w) * WEIGHT_STRENGTH_SPAN;
}

/**
 * Min–max log normalization — the family's *contrast-stretched* weight shape:
 *
 * ```txt
 * w = (ln(value + 1) − ln(min + 1)) / (ln(max + 1) − ln(min + 1))
 * ```
 *
 * Where {@link logNormalize} anchors zero at zero (absolute consensus — a 10-citation paper
 * stays light next to a 10,000-citation one), `logNormalizeBetween` stretches the SET's own
 * range to 0..1 — the lightest member reads 0, the heaviest 1 — which is what the dense
 * mosaics/front pages use so every tier is visually distinct (market caps, pageviews,
 * listens, reply tempo). Bit-identical to the pages' hand-rolled
 * `(Math.log(v + 1) − lmin) / (lmax − lmin)` for finite inputs in range.
 *
 * Degenerate set (max ≤ min — all values equal): returns `opts.equal`, default `1` (the
 * market/newsroom convention: an undifferentiated set reads heavy, not absent). Pass
 * `{ equal: 0 }` for the inverse convention. Out-of-range values clamp to 0..1; NaN reads 0.
 */
export function logNormalizeBetween(
  value: number,
  min: number,
  max: number,
  opts?: { equal?: number },
): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  const lmin = Math.log(Math.max(0, min) + 1);
  const lmax = Math.log(Math.max(0, max) + 1);
  if (!(lmax > lmin)) return opts?.equal ?? 1;
  return clamp01((Math.log(Math.max(0, value) + 1) - lmin) / (lmax - lmin));
}
