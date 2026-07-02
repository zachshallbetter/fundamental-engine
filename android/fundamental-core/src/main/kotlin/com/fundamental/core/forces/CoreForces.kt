package com.fundamental.core.forces

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.CANONICAL_FORCE_COLORS
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Force
import com.fundamental.core.engine.Particle
import com.fundamental.core.math.Vec3
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.pow

// The canonical nine forces (§6) — the Kotlin port of
// swift/Sources/FundamentalCore/Forces/CoreForces.swift. `env.vector` points from the particle toward
// the body; `env.dist ≥ 1`. Tangential terms use cross products against the plane axis (0,0,1) —
// identical to the JS 2D math at z = 0. On-state (`isEngaged`) widens range and boosts strength.
//
// Six of the nine (attract, repel, swirl, stream, tether, viscosity) are deterministic and held to
// the cross-plane conformance golden. The other three — jet (RNG cone), wall (box reflection), sink
// (stateful capture) — are not golden-testable by a single apply, so (exactly as the Swift port does)
// they are verified by behavioral unit tests instead. See CoreForcesBehaviorTests.

/** The out-of-plane axis the 2D tangential math is defined against. */
val PLANE_AXIS = Vec3(0f, 0f, 1f)

internal fun absVec(v: Vec3): Vec3 = Vec3(abs(v.x), abs(v.y), abs(v.z))

/** §6.1 — a soft gravity-like well, with optional orbital swirl. */
class AttractForce : Force {
    override val token = "attract"
    override val label = "Attract"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.5f else 1f)
        val s = body.strength * (if (body.isEngaged) 3f else 1f)
        if (env.dist >= range) return
        val f = (1f - env.dist / range).pow(2f) * s * 0.5f
        val u = env.vector / env.dist
        particle.velocity += u * f
        if (env.form.orbit != 0f) {
            particle.velocity += PLANE_AXIS.cross(u) * (f * env.form.orbit) // tangential swirl → orbits
        }
        if (body.isEngaged) particle.heat = maxOf(particle.heat, (1f - env.dist / range) * 0.9f)
    }
}

/** §6.6 — inverse-square outward push; carves a void. */
class RepelForce : Force {
    override val token = "repel"
    override val label = "Repel"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.4f else 1f)
        val s = body.strength * (if (body.isEngaged) 2f else 1f)
        if (env.dist >= range) return
        val f = (1f - env.dist / range).pow(2f) * s * 0.5f
        particle.velocity -= (env.vector / env.dist) * f
    }
}

/** §6.8 — tangential swirl with light inward retention. */
class SwirlForce : Force {
    override val token = "swirl"
    override val label = "Swirl"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.4f else 1f)
        val s = body.strength * (if (body.isEngaged) 2f else 1f)
        if (env.dist >= range) return
        val f = (1f - env.dist / range).pow(1.4f) * s * 0.45f
        val u = env.vector / env.dist
        // tangential swirl with a light inward retention (0.12): the swirl dominates ~8×, so
        // canonical swirl reads as a designed spin, not a drain.
        particle.velocity += u.cross(PLANE_AXIS) * (f * body.spin) + u * (f * 0.12f)
        if (body.isEngaged) particle.heat = maxOf(particle.heat, (1f - env.dist / range) * 0.6f)
    }
}

/** §6.5 — a steady directional current along the heading. */
class StreamForce : Force {
    override val token = "stream"
    override val label = "Stream"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.4f else 1f)
        val s = body.strength * (if (body.isEngaged) 2f else 1f)
        if (env.dist >= range) return
        val f = (1f - env.dist / range).pow(1.1f) * s * 0.5f
        particle.velocity += body.heading * f
        if (body.isEngaged) particle.heat = maxOf(particle.heat, (1f - env.dist / range) * 0.5f)
    }
}

/** §6.7 — viscosity; bleeds momentum, no redirection. */
class ViscosityForce : Force {
    override val token = "viscosity"
    override val label = "Viscosity"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.4f else 1f)
        if (env.dist >= range) return
        val k = (1f - env.dist / range) * (0.05f + body.strength * 0.07f) * (if (body.isEngaged) 1.6f else 1f)
        particle.velocity -= particle.velocity * k
    }
}

/** §6.3 — a tether with a rest length; holds matter at a shell radius. */
class TetherForce : Force {
    override val token = "tether"
    override val label = "Tether"

    override fun apply(body: Body, particle: Particle, env: Env) {
        val rest = body.range * 0.6f * (if (body.isEngaged) 1.25f else 1f)
        val reach = rest * 2.1f
        if (env.dist >= reach) return
        val k = (0.006f + body.strength * 0.012f) * (if (body.isEngaged) 1.7f else 1f)
        val stretch = env.dist - rest
        particle.velocity += (env.vector / env.dist) * (stretch * k)
        particle.velocity *= 0.985f
        if (body.isEngaged) {
            particle.heat = maxOf(particle.heat, (1f - min(1f, abs(stretch) / rest)) * 0.5f)
        }
    }
}

/** §6.2 — a conduit: draws matter in, jets it out along the heading. */
class JetForce : Force {
    override val token = "jet"
    override val label = "Jet"
    override val isKinematic = true // relaunches matter at the nozzle, so mass must not scale it

    override fun apply(body: Body, particle: Particle, env: Env) {
        val range = body.range * (if (body.isEngaged) 1.4f else 1f)
        if (env.dist >= range) return
        if (env.dist < 24f) {
            // at the nozzle: relaunch as a hot jet, with a cone of spread (about the plane axis).
            val sp = (env.rng() - 0.5f) * 0.8f
            val h = body.heading.rotatedAboutZ(sp)
            val spd = 2.4f + body.strength * 2.6f
            particle.velocity = h * spd
            particle.position = body.center + h * 26f
            particle.heat = maxOf(particle.heat, 0.9f)
        } else {
            // feed: draw surrounding matter toward the nozzle.
            val f = (1f - env.dist / range).pow(2f) * (0.25f + body.strength * 0.15f)
            particle.velocity += (env.vector / env.dist) * f
        }
    }
}

/**
 * §6.4 — an axis-aligned bouncing box; sparks on hard impact. In 3D the reflection axis is the one of
 * least penetration; a flat box (he.z == 0) only ever reflects x or y — exactly the JS wall.
 */
class WallForce : Force {
    override val token = "wall"
    override val label = "Wall"
    override val isKinematic = true // an elastic bounce reflects velocity regardless of inertia

    override fun apply(body: Body, particle: Particle, env: Env) {
        val pad = 6f
        val o = absVec(particle.position - body.center)
        val he = body.box.halfExtents
        if (o.x >= he.x + pad || o.y >= he.y + pad) return
        val solid3D = he.z > 0f
        if (solid3D && o.z >= he.z + pad) return
        val speed = particle.velocity.length()
        val px = he.x + pad - o.x
        val py = he.y + pad - o.y
        val pz = if (solid3D) he.z + pad - o.z else Float.POSITIVE_INFINITY
        val p = particle.position
        val v = particle.velocity
        if (px < py && px < pz) {
            val nx = if (p.x < body.center.x) body.center.x - he.x - pad else body.center.x + he.x + pad
            particle.position = Vec3(nx, p.y, p.z)
            particle.velocity = Vec3(-v.x * 0.85f, v.y, v.z)
        } else if (py < pz) {
            val ny = if (p.y < body.center.y) body.center.y - he.y - pad else body.center.y + he.y + pad
            particle.position = Vec3(p.x, ny, p.z)
            particle.velocity = Vec3(v.x, -v.y * 0.85f, v.z)
        } else {
            val nz = if (p.z < body.center.z) body.center.z - he.z - pad else body.center.z + he.z + pad
            particle.position = Vec3(p.x, p.y, nz)
            particle.velocity = Vec3(v.x, v.y, -v.z * 0.85f)
        }
        if (speed > 0.7f) {
            env.spark(particle.position, min(2.4f, speed), CANONICAL_FORCE_COLORS["wall"]) // canon spark tint
            particle.heat = maxOf(particle.heat, min(0.85f, speed * 0.4f))
        }
    }
}

/** §6.9 — captures matter (held, conserved), then releases on saturation. */
class SinkForce : Force {
    override val token = "sink"
    override val label = "Sink"

    override fun apply(body: Body, particle: Particle, env: Env) {
        if (particle.cap != null || env.dist >= body.absorbR) return
        particle.cap = body
        body.accreted += 1f
        if (body.accreted >= body.capacity) env.supernova(body)
    }
}

/** The canonical nine, in spec order — mirror of Swift's `coreForces()`. */
fun coreForces(): List<Force> = listOf(
    AttractForce(), JetForce(), TetherForce(), WallForce(), StreamForce(),
    RepelForce(), ViscosityForce(), SwirlForce(), SinkForce(),
)
