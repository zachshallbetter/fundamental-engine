package com.fundamental.core.math

import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.sin

// Scalar + color helpers — the Kotlin port of swift/Sources/FundamentalCore/Math/Math.swift. RGB is a
// `Vec3` of [0,255] channels, exactly as Swift aliases `RGB = SIMD3<Float>`.

/** Divide-by-zero guard at a pole — 1 unit, sub-pixel (Swift `Geometry.EPS`). */
const val EPS: Float = 1f

/** Fallback accent blue. */
val DEFAULT_ACCENT = Vec3(77f, 163f, 255f)

fun clamp(v: Float, lo: Float, hi: Float): Float = if (v < lo) lo else if (v > hi) hi else v

fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

/** Round half away from zero — matches Swift's `Float.rounded()` (Kotlin's `round` is half-to-even). */
fun roundHalfAway(v: Float): Float = if (v >= 0f) floor(v + 0.5f) else ceil(v - 0.5f)

/** Parse `#rrggbb` or `#rgb` → RGB, falling back to the default blue. */
fun hexToRgb(hex: String): Vec3 {
    var h = if (hex.startsWith("#")) hex.drop(1) else hex
    if (h.length == 3) h = h.map { "$it$it" }.joinToString("")
    if (h.length < 6) return DEFAULT_ACCENT
    val n = h.take(6).toLongOrNull(16) ?: return DEFAULT_ACCENT
    return Vec3(
        ((n shr 16) and 0xFF).toFloat(),
        ((n shr 8) and 0xFF).toFloat(),
        (n and 0xFF).toFloat(),
    )
}

/** RGB → `#rrggbb`. */
fun rgbToHex(c: Vec3): String {
    fun h(v: Float): String = clamp(roundHalfAway(v), 0f, 255f).toInt().toString(16).padStart(2, '0')
    return "#${h(c.x)}${h(c.y)}${h(c.z)}"
}

/** Lerp two hex colors by `t` ∈ [0,1]. */
fun mixHex(a: String, b: String, t: Float): String {
    val ca = hexToRgb(a)
    val cb = hexToRgb(b)
    val k = clamp(t, 0f, 1f)
    return rgbToHex(ca + (cb - ca) * k)
}

/**
 * Screen attenuation factor (workover v0.3 §"`screen` modifier"): 1 outside the range, easing down to
 * `1 − strength` at the centre, floored at `floor`. Used by the integrator's cross-body screen pass.
 */
fun screenFactor(d: Float, range: Float, strength: Float, floor: Float = 0f): Float {
    if (range <= 0f) return 1f
    val fall = max(0f, 1f - d / range)
    val factor = 1f - strength * fall * fall
    val f = clamp(floor, 0f, 1f)
    return clamp(factor, f, 1f)
}

/**
 * A smooth divergence-free flow field (§20.3) — the curl of a sinusoidal stream-function
 * ψ = sin(a)·cos(b). Closed-form (no RNG) → deterministic and exactly testable. Planar (z untouched).
 */
fun curlNoise(x: Float, y: Float, t: Float, s: Float): Vec3 {
    val a = x * s + t * 0.2f
    val b = y * s - t * 0.2f
    return Vec3(-s * sin(a) * sin(b), -s * cos(a) * cos(b), 0f)
}
