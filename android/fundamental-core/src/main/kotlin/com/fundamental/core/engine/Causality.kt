package com.fundamental.core.engine

import com.fundamental.core.math.Vec3

// Cross-boundary causality (causality.ts, Concept 4) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Causality.swift. When a body saturates (its eased density d
// climbs past a threshold) the excess spills to its neighbours, weighted by proximity, as a conserved
// transfer — hover one card and the ones beside it light up because matter actually flows between them.
// Conserved by construction: ΣΔ = 0.

data class SpillBody(val d: Float, val center: Vec3)

class SpillOpts(val threshold: Float = 0.55f, val kappa: Float = 0.6f, val falloff: Float = 320f)

/** Per-body lit delta (received − donated), index-aligned with `bodies`. Sums to 0. */
fun spillover(bodies: List<SpillBody>, opts: SpillOpts = SpillOpts()): FloatArray {
    val n = bodies.size
    val delta = FloatArray(n)
    if (n < 2) return delta

    val w = FloatArray(n)
    for (i in 0 until n) {
        val bi = bodies[i]
        val excess = bi.d - opts.threshold
        if (excess <= 0f) continue

        var total = 0f
        for (j in 0 until n) {
            if (j == i) { w[j] = 0f; continue }
            val dist = (bi.center - bodies[j].center).length()
            val ww = if (dist < opts.falloff) 1f - dist / opts.falloff else 0f
            w[j] = ww
            total += ww
        }
        if (total <= 0f) continue

        val out = opts.kappa * excess // total density this body spills
        for (j in 0 until n) {
            if (w[j] <= 0f) continue
            val phi = out * w[j] / total
            delta[j] += phi // neighbour receives
            delta[i] -= phi // this body donates (conserved)
        }
    }
    return delta
}
