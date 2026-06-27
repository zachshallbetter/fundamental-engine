package com.fundamental.core.engine

import com.fundamental.core.math.clamp
import kotlin.math.ln

// Weight primitives — the Kotlin port of swift/Sources/FundamentalCore/Engine/Weights.swift (weights.ts).
//
// The page-weight → body-strength contract made one definition: a positive magnitude
// (citations, market cap, message count) log-normalized against the set's max, then
// mapped onto the engine's attract-body strength range. Pure, deterministic maps —
// degenerate inputs (NaN, ±∞, negatives, max ≤ 0) never produce NaN.

/** The `strength` floor: `weightToStrength(0)` — a zero-weight body is light, not absent. */
const val WEIGHT_STRENGTH_BASE: Float = 0.4f

/** The `strength` span: base + span = 2.0, the heaviest attract strength the family uses. */
const val WEIGHT_STRENGTH_SPAN: Float = 1.6f

/**
 * Log-normalize a positive magnitude against the set's max:
 * `weight = clamp01( ln(value + 1) / ln(max + 1) )` — heavy tails compress, zero stays
 * exactly 0, value == max reads exactly 1. `max ≤ 0` (or non-finite) returns 0.
 */
fun logNormalize(value: Float, max: Float): Float {
    if (!max.isFinite() || max <= 0f) return 0f
    val v = if (value > 0f) value else 0f // NaN/negatives/−∞ read as 0; +∞ clamps below
    return clamp(ln(v + 1f) / ln(max + 1f), 0f, 1f)
}

/** The result of [logNormalizeAll] — weights index-aligned with the inputs, plus the set's max. */
data class LogNormalizeAll(val weights: List<Float>, val max: Float)

/**
 * [logNormalize] over a whole set in one pass; weights index-aligned with `values`,
 * each normalized against the set's own max. Returns the max too, so live pages can
 * re-normalize incoming single values between full passes.
 */
fun logNormalizeAll(values: List<Float>): LogNormalizeAll {
    var max = 0f
    for (v in values) if (v.isFinite() && v > max) max = v
    return LogNormalizeAll(values.map { logNormalize(it, max) }, max)
}

/**
 * The page-weight → engine-strength contract:
 * `strength = 0.4 + w·1.6`, so w ∈ 0…1 → strength ∈ 0.4…2.0.
 * NaN reads as 0 — an unknown weight is a light body, not a NaN attribute.
 */
fun weightToStrength(w: Float): Float =
    WEIGHT_STRENGTH_BASE + clamp(if (w.isNaN()) 0f else w, 0f, 1f) * WEIGHT_STRENGTH_SPAN

/**
 * Min–max log normalization — the contrast-stretched weight shape: the SET's own range
 * stretches to 0…1 (lightest member 0, heaviest 1). Degenerate set (all equal) returns
 * `equal` (default 1 — an undifferentiated set reads heavy, not absent).
 */
fun logNormalizeBetween(value: Float, min: Float, max: Float, equal: Float = 1f): Float {
    if (!value.isFinite()) return 0f
    val lmin = ln(kotlin.math.max(0f, min) + 1f)
    val lmax = ln(kotlin.math.max(0f, max) + 1f)
    if (lmax <= lmin) return equal
    return clamp((ln(kotlin.math.max(0f, value) + 1f) - lmin) / (lmax - lmin), 0f, 1f)
}
