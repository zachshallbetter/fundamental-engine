package com.fundamental.core.engine

import com.fundamental.core.math.EPS
import com.fundamental.core.math.Vec3
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Geometry helpers — the Kotlin port of swift/Sources/FundamentalCore/Math/Geometry.swift. `Box` itself
// lives in engine/Types.kt; this file adds the dipole geometry and box queries the integrator and the
// magnetism/charge field() hooks use.

/** Box + heading (unit Vec3) + polarity spin — the dipole axis. */
data class AxisBox(val box: Box, val heading: Vec3, val spin: Float)

/** One pole of a dipole: a 3D position and signed charge (±1). */
data class Pole(val position: Vec3, val charge: Float)

/** The nearest point of the filled box to [p]: closest boundary point outside, `p` itself inside. */
fun nearestOnBox(p: Vec3, b: Box): Vec3 {
    val lo = b.center - b.halfExtents
    val hi = b.center + b.halfExtents
    fun c(v: Float, l: Float, h: Float) = if (v < l) l else if (v > h) h else v
    return Vec3(c(p.x, lo.x, hi.x), c(p.y, lo.y, hi.y), c(p.z, lo.z, hi.z))
}

/** Signed distance to the box: negative inside, zero on the edge, positive outside (3D box SDF). */
fun sdfBox(p: Vec3, b: Box): Float {
    val q = Vec3(abs(p.x - b.center.x), abs(p.y - b.center.y), abs(p.z - b.center.z)) - b.halfExtents
    val outside = Vec3(max(q.x, 0f), max(q.y, 0f), max(q.z, 0f)).length()
    val inside = min(max(q.x, max(q.y, q.z)), 0f)
    return outside + inside
}

/**
 * The two poles of the body's dipole, laid on its heading axis at the box edge. The `+` (N) pole sits
 * at `+heading`; `spin < 0` swaps them. Reach is proportional to the box extent along the heading.
 */
fun polePair(b: AxisBox): Pair<Pole, Pole> {
    val he = b.box.halfExtents
    val h = b.heading
    val tx = if (h.x != 0f) he.x / abs(h.x) else Float.POSITIVE_INFINITY
    val ty = if (h.y != 0f) he.y / abs(h.y) else Float.POSITIVE_INFINITY
    val tz = if (h.z != 0f) he.z / abs(h.z) else Float.POSITIVE_INFINITY
    val reach = min(tx, min(ty, tz))
    val axis = h * reach
    val s = if (b.spin < 0f) -1f else 1f
    return Pair(
        Pole(b.box.center + axis, s),
        Pole(b.box.center - axis, -s),
    )
}

/** Superposition of a set of poles' radial q/d² fields at [p] — the bar-magnet / dipole field. */
fun dipoleField(poles: List<Pole>, p: Vec3): Vec3 {
    var f = Vec3.ZERO
    for (pole in poles) {
        val d = p - pole.position
        val dn = max(EPS, d.length())
        val k = pole.charge / (dn * dn)
        f += (d / dn) * k
    }
    return f
}

/**
 * The net *structure* field at a point: the superposition of every visible body's `field()`
 * contribution, with the same range cull as the integrator. The field streamlines draw and `fieldflow`
 * follows. Pure — no env mutation, safe mid-integration. (Swift `netField`, streamlines.swift.)
 */
fun netField(bodies: List<Body>, forces: ForceRegistry, point: Vec3): Vec3 {
    var f = Vec3.ZERO
    for (b in bodies) {
        if (!b.isVisible || b.tokens.isEmpty()) continue
        if (b.range > 0f) {
            val delta = b.center - point
            if (delta.lengthSquared() >= b.range * b.range * 2.56f) continue
        }
        for (tok in b.tokens) {
            forces[tok]?.field(b, point)?.let { f += it }
        }
    }
    return f
}
