import Foundation

// MARK: - Weight primitives (weights.ts)
//
// The page-weight → body-strength contract made one definition: a positive magnitude
// (citations, market cap, message count) log-normalized against the set's max, then
// mapped onto the engine's attract-body strength range. Pure, deterministic maps —
// degenerate inputs (NaN, ±∞, negatives, max ≤ 0) never produce NaN.

/// The `strength` floor: `weightToStrength(0)` — a zero-weight body is light, not absent.
public let WEIGHT_STRENGTH_BASE: Float = 0.4
/// The `strength` span: base + span = 2.0, the heaviest attract strength the family uses.
public let WEIGHT_STRENGTH_SPAN: Float = 1.6

/// Log-normalize a positive magnitude against the set's max:
/// `weight = clamp01( ln(value + 1) / ln(max + 1) )` — heavy tails compress, zero stays
/// exactly 0, value == max reads exactly 1. `max ≤ 0` (or non-finite) returns 0.
public func logNormalize(_ value: Float, max: Float) -> Float {
    guard max.isFinite, max > 0 else { return 0 }
    let v = value > 0 ? value : 0 // NaN/negatives/−∞ read as 0; +∞ clamps below
    return clamp(log(v + 1) / log(max + 1), 0, 1)
}

/// `logNormalize` over a whole set in one pass; weights index-aligned with `values`,
/// each normalized against the set's own max. Returns the max too, so live pages can
/// re-normalize incoming single values between full passes.
public func logNormalizeAll(_ values: [Float]) -> (weights: [Float], max: Float) {
    var max: Float = 0
    for v in values where v.isFinite && v > max { max = v }
    return (values.map { logNormalize($0, max: max) }, max)
}

/// The page-weight → engine-strength contract:
/// `strength = 0.4 + w·1.6`, so w ∈ 0…1 → strength ∈ 0.4…2.0.
/// NaN reads as 0 — an unknown weight is a light body, not a NaN attribute.
public func weightToStrength(_ w: Float) -> Float {
    WEIGHT_STRENGTH_BASE + clamp(w.isNaN ? 0 : w, 0, 1) * WEIGHT_STRENGTH_SPAN
}

/// Min–max log normalization — the contrast-stretched weight shape: the SET's own range
/// stretches to 0…1 (lightest member 0, heaviest 1). Degenerate set (all equal) returns
/// `equal` (default 1 — an undifferentiated set reads heavy, not absent).
public func logNormalizeBetween(_ value: Float, min: Float, max: Float, equal: Float = 1) -> Float {
    guard value.isFinite else { return 0 }
    let lmin = log(Swift.max(0, min) + 1)
    let lmax = log(Swift.max(0, max) + 1)
    guard lmax > lmin else { return equal }
    return clamp((log(Swift.max(0, value) + 1) - lmin) / (lmax - lmin), 0, 1)
}
