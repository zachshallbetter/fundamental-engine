package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// The bound↔free reservoir (reservoir.ts, §2.4) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Reservoir.swift.
//
// The conserved exchange between the calm matter riding the Currents (bound) and the
// roaming matter (free). Wave-healing reclaims calm free particles onto the lines (up to
// boundTarget, so the lines never vacuum the open field); tearing rips bound matter
// loose with an outward kick. Count is conserved throughout.

// `BoundParticle` is defined in Currents.kt (alongside the waves it rides).

/** Reclaim calm free matter onto the nearest line, up to [boundTarget] (§2.4). */
fun healWaves(
    store: FieldStore,
    bound: MutableList<BoundParticle>,
    boundTarget: Int,
    waves: List<Wave>,
    W: Float,
    H: Float,
    time: Float,
    rand: () -> Float,
) {
    if (waves.isEmpty()) return
    for (p in store.particles.reversed()) {
        if (bound.size >= boundTarget) break
        if (p.cap != null || p.heat >= 0.12f) continue

        // nearest wave line
        var nwi = -1
        var nwd = 1e9f
        var nwy = 0f
        for ((wi, w) in waves.withIndex()) {
            val wy = waveYat(w, x = p.position.x, time = time, H = H)
            val dd = abs(wy - p.position.y)
            if (dd < nwd) {
                nwd = dd
                nwi = wi
                nwy = wy
            }
        }
        if (nwi < 0 || nwd >= 64f) continue

        // drift toward the line; snap home when very close, calm, and (rarely) lucky.
        val pull = min(0.012f, nwd * 0.0004f) * (1f - p.heat / 0.12f)
        val dvy = if (nwy > p.position.y) pull else -pull
        p.velocity = Vec3(p.velocity.x, p.velocity.y + dvy, p.velocity.z)
        if (nwd < 20f && p.velocity.lengthSquared() < 0.3f && rand() < 0.03f) {
            bound.add(
                BoundParticle(
                    wi = nwi,
                    progress = p.position.x / W,
                    phase = (rand() - 0.5f) * 0.22f * PI.toFloat(),
                    size = p.size,
                    glow = rand() < 0.3f,
                    speed = (0.00035f + rand() * 0.0009f) * (if (rand() < 0.5f) 1f else -1f),
                ),
            )
            store.remove(p)
        }
    }
}

/** Tear bound matter within [radius] of a point loose into the free pool (§6.9). */
fun tearBoundNear(
    bound: MutableList<BoundParticle>,
    waves: List<Wave>,
    center: Vec3,
    radius: Float,
    W: Float,
    H: Float,
    time: Float,
    spawn: (Particle) -> Unit,
) {
    var i = bound.size - 1
    while (i >= 0) {
        val p = bound[i]
        if (!waves.indices.contains(p.wi)) {
            i -= 1
            continue
        }
        val w = waves[p.wi]
        val x = p.progress * W
        val y = waveYat(w, x = x, time = time, H = H) + p.phase * 32f
        val d3 = Vec3(x, y, 0f) - center
        val d = d3.length()
        if (d < radius && d > 0.5f) {
            val f = (1f - d / radius) * 4f
            val np = Particle(position = Vec3(x, y, 0f), velocity = (d3 / d) * f, heat = 0.9f, size = p.size)
            spawn(np)
            val last = bound.removeAt(bound.size - 1)
            if (i < bound.size) bound[i] = last
        }
        i -= 1
    }
}

/**
 * Force-tearing (§2.4): any force reaching a bound particle tears it loose into the
 * free pool with a kick, so it then *feels* the force. Selective gates act on free
 * matter only, so only always/active bodies tear bound.
 */
fun tearBoundByForces(
    bound: MutableList<BoundParticle>,
    waves: List<Wave>,
    bodies: List<Body>,
    forces: ForceRegistry,
    W: Float,
    H: Float,
    time: Float,
    spawn: (Particle) -> Unit,
) {
    // a body "exerts force" if it carries any non-modifier, non-source token. Modifiers
    // (resonate/spotlight) and pure sources (spawn) never tear bound particles.
    // "Pure source" = a force whose work is in source() (its apply is a no-op): spawn.
    fun exertsForce(b: Body): Boolean =
        b.tokens.any { tok ->
            val f = forces[tok] ?: return@any false
            !f.hasModify && tok != "spawn" && tok != "propagate" && tok != "screen"
        }

    var i = bound.size - 1
    while (i >= 0) {
        val p = bound[i]
        if (!waves.indices.contains(p.wi)) {
            i -= 1
            continue
        }
        val w = waves[p.wi]
        val x = p.progress * W
        val y = waveYat(w, x = x, time = time, H = H) + p.phase * 32f

        var hit = false
        var kick = Vec3.ZERO
        for (b in bodies) {
            if (!b.isVisible) continue
            if (b.`when` == "active" && !b.isEngaged) continue
            if (b.`when`.isNotEmpty() && b.`when` != "active") continue // selective → free agents only
            val toks = b.tokens
            val d3 = b.center - Vec3(x, y, 0f)
            val dist = max(d3.length(), 1f)
            val range = b.range * (if (b.isEngaged) 1.4f else 1f)

            if (toks.contains("wall")) {
                val pad = 6f
                if (abs(x - b.center.x) < b.box.hw + pad && abs(y - b.center.y) < b.box.hh + pad) {
                    kick = Vec3((if (x < b.center.x) -1f else 1f) * 1.6f, (if (y < b.center.y) -1f else 1f) * 0.8f, 0f)
                    hit = true
                }
            }
            if (!hit && (toks.contains("attract") || toks.contains("sink") || toks.contains("jet"))) {
                if (dist < range * 0.8f) {
                    val k = 1.2f + (if (b.isEngaged) 1.6f else 0f)
                    kick = (d3 / dist) * k
                    hit = true
                }
            }
            if (!hit && toks.contains("repel") && dist < range * 0.8f) {
                val k = 1.2f + (if (b.isEngaged) 1.2f else 0f)
                kick = (d3 / dist) * -k
                hit = true
            }
            if (!hit && toks.contains("swirl") && dist < range * 0.75f) {
                kick = Vec3(d3.y / dist, -d3.x / dist, 0f) * 1.2f
                hit = true
            }
            if (!hit && toks.contains("stream") && dist < range * 0.75f) {
                kick = b.heading * 1.3f
                hit = true
            }
            // every other force-bearing body also frees nearby bound matter, with a gentle
            // inward nudge, so the integrator's real force can act on it (§2.4).
            if (!hit && dist < range * 0.8f && exertsForce(b)) {
                val k = 0.8f + (if (b.isEngaged) 0.8f else 0f)
                kick = (d3 / dist) * k
                hit = true
            }
            if (hit) break
        }

        if (hit) {
            val np = Particle(position = Vec3(x, y, 0f), velocity = kick, heat = 0.5f, size = p.size)
            spawn(np)
            val last = bound.removeAt(bound.size - 1)
            if (i < bound.size) bound[i] = last
        }
        i -= 1
    }
}

/**
 * Charge induction (§20.10) — a *field-level* polarization, separate from the force.
 * A charge/magnetism body polarizes the neutral matter that enters its field: a neutral
 * particle picks up a sign by which side of the body it sits on. Induced once — matter
 * carries its sign thereafter. Lives here, not in the force's apply, so the force's
 * golden contract ("ignores neutral matter") stays exactly true.
 */
fun induceCharges(bodies: List<Body>, particles: List<Particle>) {
    for (b in bodies) {
        if (!b.isVisible) continue
        if (!b.tokens.contains("charge") && !b.tokens.contains("magnetism")) continue
        if (b.range <= 0f) continue // a global field has no side to polarize by
        val r2 = b.range * b.range
        for (p in particles) {
            val q = p.charge
            if (q != null && q != 0f) continue // already signed — matter carries its charge
            val d3 = b.center - p.position
            if (d3.lengthSquared() >= r2) continue
            p.charge = if (d3.x >= 0f) 1f else -1f // polarize by side → a two-domain +/- split
        }
    }
}
