package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
import kotlin.math.acos
import kotlin.math.sqrt

// Streamlines / vector-field probes (streamlines.ts, §20.6 diagnostic) — the Kotlin port of the
// overlay-reading computations in swift/Sources/FundamentalCore/Engine/Streamlines.swift.
// `netField` lives in Geometry.kt; this file adds the force probe + the field-line tracer.

/**
 * Net force a zero-velocity test particle would feel at a point — the field vector the streamlines /
 * force-vector readings draw. Mirrors the integrator's body-force loop (same range cull), minus the
 * per-particle modifier pass. A force that defines a `field()` contributes that instead of its `apply`,
 * so velocity-/charge-dependent forces (magnetism, charge) still appear on a still, neutral probe.
 */
fun forceAt(bodies: List<Body>, forces: ForceRegistry, point: Vec3): Vec3 {
    val probe = Particle(position = point)
    val env = Env()
    var fieldSum = Vec3.ZERO
    for (b in bodies) {
        if (!b.isVisible || b.tokens.isEmpty()) continue
        val delta = if (b.shaped) nearestOnBox(point, b.box) - point else b.center - point
        val d2 = delta.lengthSquared()
        if (b.range > 0f && d2 >= b.range * b.range * 2.56f) continue
        val d = sqrt(d2)
        env.vector = delta
        env.dist = if (d < 1f) 1f else d
        for (tok in b.tokens) {
            val f = forces[tok] ?: continue
            if (f.hasModify) continue
            val v = f.field(b, point)
            if (v != null) fieldSum += v else f.apply(b, probe, env)
        }
    }
    return probe.velocity + fieldSum
}

// ── field-line tracing (fieldlines.ts, Stage B2) ──────────────────────────────────────────────────

/** A point sampler for the vector field being traced. */
typealias FieldSampler = (Vec3) -> Vec3

/** Options for [traceFieldLine]. */
data class FieldLineOpts(
    val step: Float = 6f,
    val maxSteps: Int = 400,
    val minStrength: Float = 1e-9f,
    /** Viewport (w, h); stop when the line leaves it by more than a step. Null = unbounded. */
    val bounds: Pair<Float, Float>? = null,
    val loopDist: Float = 6f,
    /** Turning budget in revolutions; stop once cumulative heading change exceeds it (orbit guard). */
    val maxTurns: Float = Float.POSITIVE_INFINITY,
)

private fun traceOne(sample: FieldSampler, seed: Vec3, dir: Float, o: FieldLineOpts): MutableList<Vec3> {
    val pts = mutableListOf(seed)
    var p = seed
    val m = o.step
    var prevDir = Vec3.ZERO
    var turned = 0f
    val turnBudget = o.maxTurns * 2f * Math.PI.toFloat()
    for (i in 0 until o.maxSteps) {
        val f = sample(p)
        val mag = f.length()
        if (!(mag >= o.minStrength)) break
        val u = (f / mag) * dir
        if (turnBudget.isFinite()) {
            if (prevDir != Vec3.ZERO) {
                val dot = clamp(u.dot(prevDir), -1f, 1f)
                turned += acos(dot)
                if (turned > turnBudget) break
            }
            prevDir = u
        }
        p += u * o.step
        val b = o.bounds
        if (b != null && (p.x < -m || p.y < -m || p.x > b.first + m || p.y > b.second + m)) break
        if (i > 4 && (p - seed).length() < o.loopDist) { pts.add(p); break }
        pts.add(p)
    }
    return pts
}

/** Trace a full field line through a seed: upstream reversed, then downstream, seed mid-line. */
fun traceFieldLine(sample: FieldSampler, seed: Vec3, opts: FieldLineOpts = FieldLineOpts()): List<Vec3> {
    val back = traceOne(sample, seed, -1f, opts)
    val fwd = traceOne(sample, seed, 1f, opts)
    back.reverse()
    if (back.isNotEmpty()) back.removeAt(back.size - 1) // drop the duplicated seed shared with fwd[0]
    return back + fwd
}

/** Trace a field line from each seed; empty/degenerate lines are dropped. */
fun traceFieldLines(sample: FieldSampler, seeds: List<Vec3>, opts: FieldLineOpts = FieldLineOpts()): List<List<Vec3>> =
    seeds.map { traceFieldLine(sample, it, opts) }.filter { it.size > 1 }
