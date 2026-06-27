package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
import kotlin.math.min

// Measured thermodynamics — the Kotlin port of swift/Sources/FundamentalCore/Engine/Thermo.swift
// (thermo.ts, workover v0.3 §"Metrics").
//
// Entropy, coherence, and temperature are METRICS — measured, never applied as forces.
// The engine samples each feedback body's local neighborhood during the existing density
// pass (the same range/2 window that feeds b.count — no new O(particles × bodies) work),
// accumulates the sums in b.thermo, and this module turns them into the measurements
// exported through the feedback sink.
//
//   R           = |Σv| / Σ|v|               — velocity alignment (mean resultant length)
//   entropy     = (1 − R) · min(1, s̄ / 1.5) — direction dispersion, gated by agitation
//   coherence   = 1 − entropy                — the complement relation, exactly
//   temperature = ½·h̄ + ½·min(1, s̄²/9)      — half mean heat, half normalized kinetic

/** Reference squared speed for temperature normalization — (3 px/frame)². */
const val TEMP_SPEED2_REF: Float = 9f

/** Mean speed at which directional dispersion counts fully toward entropy. */
const val ENTROPY_AGITATION_REF: Float = 1.5f

/**
 * Thermodynamic accumulator — the Swift `Body.Thermo` nested struct, exposed standalone so it can be
 * attached to `Body` via a `var thermo: Thermo?` field on Types.kt.
 */
class Thermo {
    var n: Int = 0
    var sv: Vec3 = Vec3.ZERO   // Σvelocity
    var ss: Float = 0f         // Σ|v|
    var ss2: Float = 0f        // Σ|v|²
    var sh: Float = 0f         // Σheat
}

/**
 * The three measured metrics — the Swift `Body.Metrics` nested struct, exposed standalone so it can be
 * attached to `Body` via a `var metrics: Metrics?` field on Types.kt.
 */
class Metrics {
    var entropy: Float = 0f       // ∈ [0,1]
    var coherence: Float = 0f     // ∈ [0,1]
    var temperature: Float = 0f   // ∈ [0,1]
}

/**
 * The three measured metrics from an accumulator (null/empty ⇒ a quiet region:
 * entropy 0, coherence 1, temperature 0). Pure and deterministic.
 */
fun thermoMetrics(a: Thermo?): Metrics {
    if (a == null || a.n <= 0) {
        val m = Metrics()
        m.coherence = 1f
        return m
    }
    val n = a.n.toFloat()
    val meanHeat = a.sh / n
    val meanSpeed = a.ss / n
    val meanSpeed2 = a.ss2 / n
    val temperature = clamp(0.5f * meanHeat + 0.5f * min(1f, meanSpeed2 / TEMP_SPEED2_REF), 0f, 1f)
    // velocity alignment R ∈ [0,1]: 1 = every sampled velocity points the same way.
    // A near-still sample (Σ|v| ≈ 0) is treated as fully ordered.
    val r: Float = if (a.ss > 1e-9f) a.sv.length() / a.ss else 1f
    val entropy = clamp((1f - r) * min(1f, meanSpeed / ENTROPY_AGITATION_REF), 0f, 1f)
    val m = Metrics()
    m.entropy = entropy
    m.coherence = 1f - entropy
    m.temperature = temperature
    return m
}
