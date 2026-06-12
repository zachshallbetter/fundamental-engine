import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Cross-boundary causality (causality.ts, Concept 4)
//
// Density doesn't stop at a body's edge. When a body saturates (its eased density d
// climbs past a threshold), the excess **spills to its neighbours**, weighted by
// proximity, as a conserved transfer — hover one card and the ones beside it light up
// because matter actually flows between them.
//
//   excessᵢ = max(0, dᵢ − θ)
//   wᵢⱼ     = max(0, 1 − dist(i,j)/falloff)
//   Φᵢⱼ     = κ · excessᵢ · wᵢⱼ / Σₖ wᵢₖ
//   Δⱼ      = Σᵢ Φᵢⱼ − Σⱼ Φⱼₖ
//
// Conserved by construction: ΣΔ = 0.

public struct SpillBody {
    /// Eased density d ∈ [0,1] (§8).
    public var d: Float
    public var center: Vec3

    public init(d: Float, center: Vec3) {
        self.d = d
        self.center = center
    }
}

public struct SpillOpts {
    /// Density above which a body spills its excess.
    public var threshold: Float = 0.55
    /// Fraction of the excess that flows out.
    public var kappa: Float = 0.6
    /// Proximity reach in px — past this, no transfer.
    public var falloff: Float = 320

    public init() {}
}

/// Per-body lit delta (received − donated), index-aligned with `bodies`. Sums to 0.
public func spillover(_ bodies: [SpillBody], opts: SpillOpts = SpillOpts()) -> [Float] {
    let n = bodies.count
    var delta = [Float](repeating: 0, count: n)
    if n < 2 { return delta }

    var w = [Float](repeating: 0, count: n)
    for i in 0..<n {
        let bi = bodies[i]
        let excess = bi.d - opts.threshold
        if excess <= 0 { continue }

        // proximity weights to every other body within reach
        var total: Float = 0
        for j in 0..<n {
            if j == i {
                w[j] = 0
                continue
            }
            let dist = simd_distance(bi.center, bodies[j].center)
            let ww: Float = dist < opts.falloff ? 1 - dist / opts.falloff : 0
            w[j] = ww
            total += ww
        }
        if total <= 0 { continue }

        let out = opts.kappa * excess // total density this body spills
        for j in 0..<n where w[j] > 0 {
            let phi = out * w[j] / total
            delta[j] += phi // neighbour receives
            delta[i] -= phi // this body donates (conserved)
        }
    }
    return delta
}
