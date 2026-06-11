import Foundation
import simd

// MARK: - Measured thermodynamics (thermo.ts, workover v0.3 §"Metrics")
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

/// Reference squared speed for temperature normalization — (3 px/frame)².
public let TEMP_SPEED2_REF: Float = 9
/// Mean speed at which directional dispersion counts fully toward entropy.
public let ENTROPY_AGITATION_REF: Float = 1.5

/// The three measured metrics from an accumulator (nil/empty ⇒ a quiet region:
/// entropy 0, coherence 1, temperature 0). Pure and deterministic.
public func thermoMetrics(_ a: Body.Thermo?) -> Body.Metrics {
    guard let a, a.n > 0 else {
        var m = Body.Metrics()
        m.coherence = 1
        return m
    }
    let n = Float(a.n)
    let meanHeat = a.sh / n
    let meanSpeed = a.ss / n
    let meanSpeed2 = a.ss2 / n
    let temperature = clamp(0.5 * meanHeat + 0.5 * min(1, meanSpeed2 / TEMP_SPEED2_REF), 0, 1)
    // velocity alignment R ∈ [0,1]: 1 = every sampled velocity points the same way.
    // A near-still sample (Σ|v| ≈ 0) is treated as fully ordered.
    let R: Float = a.ss > 1e-9 ? simd_length(a.sv) / a.ss : 1
    let entropy = clamp((1 - R) * min(1, meanSpeed / ENTROPY_AGITATION_REF), 0, 1)
    var m = Body.Metrics()
    m.entropy = entropy
    m.coherence = 1 - entropy
    m.temperature = temperature
    return m
}
