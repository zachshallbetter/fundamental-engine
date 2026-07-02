package com.fundamental.core.forces

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Force
import com.fundamental.core.engine.ForceModification
import com.fundamental.core.engine.Particle
import com.fundamental.core.math.Vec3
import com.fundamental.core.math.curlNoise
import com.fundamental.core.math.mixHex
import com.fundamental.core.math.roundHalfAway
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

// Designed extended forces (§20.3) — the Kotlin port of
// swift/Sources/FundamentalCore/Forces/ExtendedForces.swift. Like the canonical nine these are designed
// (finite range, soft falloff), but they live outside the core as opt-in enrichments. Verified
// behaviorally (closed-form ones exactly; neighbor/RNG/field ones against a constructed Env).

/** §20.3 — `lens`: rotate the velocity, preserving its magnitude — bends the path, not the speed. */
class LensForce : Force {
    override val token = "lens"
    override val label = "Lens"
    override val isKinematic = true
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val theta = body.strength * (1f - env.dist / body.range) * body.spin
        particle.velocity = particle.velocity.rotatedAboutZ(theta)
    }
}

/** §20.3 — `gate`: a one-way membrane. Wrong-way crossers (v·n < 0) are reflected: v −= 2(v·n)·n. */
class GateForce : Force {
    override val token = "gate"
    override val label = "Gate"
    override val isKinematic = true
    override fun apply(body: Body, particle: Particle, env: Env) {
        val pad = 6f
        val o = absVec(particle.position - body.center)
        if (o.x >= body.box.hw + pad || o.y >= body.box.hh + pad) return
        val vn = particle.velocity.dot(body.heading) // velocity along the heading n
        if (vn < 0f) particle.velocity -= body.heading * (2f * vn) // reflect the wrong-way crosser
    }
}

private const val BUOY_BASE = 1f
private const val BUOY_MEDIUM = 1f

/** §20.3 — `buoyancy`: a constant lift/sink by density difference. Engine +y is down, so lift subtracts. */
class BuoyancyForce : Force {
    override val token = "buoyancy"
    override val label = "Buoyancy"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (body.range > 0f && env.dist >= body.range) return // range 0 ⇒ global field
        val rhoP = BUOY_BASE / (particle.size * (1f + particle.heat)) // hotter/bigger → lighter
        val lift = (BUOY_MEDIUM - rhoP) * body.strength
        val v = particle.velocity
        particle.velocity = Vec3(v.x, v.y - lift, v.z) // lift up (−y) when lighter
    }
}

/** §20.3 — `shear`: a laminar velocity gradient (Couette flow) along the heading by perpendicular offset. */
class ShearForce : Force {
    override val token = "shear"
    override val label = "Shear"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val perp = PLANE_AXIS.cross(body.heading)
        val offsetPerp = (particle.position - body.center).dot(perp)
        val f = body.strength * (offsetPerp / body.range) * (1f - env.dist / body.range)
        particle.velocity += body.heading * f
    }
}

private const val LATTICE = 32f // lattice cell, px
private const val FREEZE = 0.5f // heat below which matter solidifies

/** §20.3 — `crystallize`: while cool, snap toward the nearest lattice node and damp; once hot, melt. */
class CrystallizeForce : Force {
    override val token = "crystallize"
    override val label = "Crystallize"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range || particle.heat >= FREEZE) return
        val nodeX = body.center.x + roundHalfAway((particle.position.x - body.center.x) / LATTICE) * LATTICE
        val nodeY = body.center.y + roundHalfAway((particle.position.y - body.center.y) / LATTICE) * LATTICE
        val v = particle.velocity
        particle.velocity = Vec3(
            (v.x + (nodeX - particle.position.x) * body.strength) * 0.9f, // pull to node, then damp
            (v.y + (nodeY - particle.position.y) * body.strength) * 0.9f,
            v.z,
        )
    }
}

/** §20.3 — `align`: steer velocity toward the mean neighbour heading (boids), preserving speed. */
class AlignForce : Force {
    override val token = "align"
    override val label = "Align"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val speed = particle.velocity.length()
        val k = body.strength
        var h = body.heading // [A] default: the body heading
        var s = Vec3.ZERO
        for (n in env.neighbors(particle, body.range)) {
            val ns = n.velocity.length()
            if (ns > 1e-6f) s += n.velocity / ns // sum the neighbours' unit velocities
        }
        val sm = s.length()
        if (sm > 1e-6f) h = s / sm // [B]: the mean neighbour heading
        particle.velocity += (h * speed - particle.velocity) * k
    }
}

private const val WIND_SCALE = 0.01f

/** §20.3 — `wind`: divergence-free turbulence, v += curl(noise)·S. Range 0 = a global gust. */
class WindForce : Force {
    override val token = "wind"
    override val label = "Wind"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (body.range > 0f && env.dist >= body.range) return
        particle.velocity += curlNoise(particle.position.x, particle.position.y, env.t, WIND_SCALE) * body.strength
    }
}

private const val COHESION_REST = 0.5f // r₀ as a fraction of r₁

/** §20.3 — `cohesion`: short-range pressure + mid-range pull — surface tension around a rest distance. */
class CohesionForce : Force {
    override val token = "cohesion"
    override val label = "Cohesion"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val r1 = body.range
        val r0 = r1 * COHESION_REST
        val k = body.strength
        for (n in env.neighbors(particle, r1)) {
            val d3 = n.position - particle.position
            val dn = d3.length()
            if (dn < 1e-6f) continue
            val u = d3 / dn
            if (dn < r0) {
                particle.velocity -= u * (k * (r0 - dn) / r0) // pressure: push apart
            } else {
                particle.velocity += u * (k * (dn - r0) / (r1 - r0)) // cohesion: pull toward the skin
            }
        }
    }
}

private const val PRESSURE_REST = 0.5f // ρ₀ — the rest density

/** §20.3 — `pressure`: SPH density relaxation → an incompressible even-fill; push down the density gradient. */
class PressureForce : Force {
    override val token = "pressure"
    override val label = "Pressure"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val h = body.range
        val k = body.strength
        val ns = env.neighbors(particle, h)
        var rho = 0f // first pass: local density ρ_p = Σ W(d, h)
        for (n in ns) {
            val d = (n.position - particle.position).length()
            if (d < h) rho += (1f - d / h).pow(2f)
        }
        val over = rho - PRESSURE_REST
        if (over <= 0f) return // under-dense → no push
        for (n in ns) { // second pass: push away along the density gradient
            val d3 = particle.position - n.position
            val d = d3.length()
            if (d < 1e-6f || d >= h) continue
            particle.velocity += d3 * (k * over * (1f - d / h) / d)
        }
    }
}

private const val LINK_REST = 0.35f // rest length L as a fraction of the bond radius

/** §20.3 — `link`: a Verlet distance constraint holding matter at a rest length; each side applies half. */
class LinkForce : Force {
    override val token = "link"
    override val label = "Link"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val r = body.range
        val l = r * LINK_REST
        val k = body.strength
        for (n in env.neighbors(particle, r)) {
            val d3 = n.position - particle.position
            val d = d3.length()
            if (d < 1e-6f) continue
            val err = d - l // +ve → too far (pull together); −ve → too close (push apart)
            particle.velocity += (d3 / d) * (0.5f * k * (err / l))
        }
    }
}

/** §20.3 — `hunt`: two-species pursuit. Predators (species 0) chase the nearest other species; prey flee. */
class HuntForce : Force {
    override val token = "hunt"
    override val label = "Hunt"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val me = particle.species ?: 0
        var target: Particle? = null
        var bestD2 = Float.POSITIVE_INFINITY
        for (n in env.neighbors(particle, body.range)) {
            if ((n.species ?: 0) == me) continue
            val d2 = (n.position - particle.position).lengthSquared()
            if (d2 < bestD2) {
                bestD2 = d2
                target = n
            }
        }
        val tgt = target ?: return // nothing of the other species in reach
        val d3 = tgt.position - particle.position
        val d = max(1f, d3.length())
        val dir = if (me == 0) 1f else -1f // predator seeks, prey flees
        particle.velocity += (d3 / d) * (body.strength * dir)
    }
}

private const val MORPH_ARRIVE = 40f // px within which a particle counts as "arrived"

/** §20.3 — `morph`: matter springs toward a stable target mark (never letterforms, §11); jitter fades. */
class MorphForce : Force {
    override val token = "morph"
    override val label = "Morph"
    override fun apply(body: Body, particle: Particle, env: Env) {
        val ts = body.targets ?: return
        if (ts.isEmpty()) return
        val i = min(ts.size - 1, (particle.gx * ts.size).toInt()) // stable hash from the scatter fraction
        val t = ts[i]
        val d3 = t - particle.position
        val d = d3.length()
        val k = body.strength
        particle.velocity += d3 * (k * 0.02f) // spring toward the target
        val arrived = if (d < MORPH_ARRIVE) 1f - d / MORPH_ARRIVE else 0f
        val jit = (1f - arrived) * k * 0.3f // jitter that fades to zero on arrival
        if (jit > 0f) {
            val v = particle.velocity
            particle.velocity = Vec3(
                v.x + (env.rng() - 0.5f) * jit,
                v.y + (env.rng() - 0.5f) * jit,
                v.z,
            )
        }
    }
}

/** Default frames-to-live for `spawn` matter. */
const val SPAWN_LIFE = 90f

/** §20.1/§20.2 — `spawn`: the one force that creates matter, in a soft cone, budgeted by life/sourceCap. */
class SpawnForce : Force {
    override val token = "spawn"
    override val label = "Spawn"
    override fun apply(body: Body, particle: Particle, env: Env) {} // a source — work in source()

    override fun source(body: Body, env: Env) {
        val life = body.life ?: SPAWN_LIFE
        var rate = max(1f, roundHalfAway(body.strength * 2f)) // particles per frame
        val cap = body.sourceCap
        if (cap != null && cap > 0 && life > 0f) rate = min(rate, cap.toFloat() / life)
        body.emitAcc = (body.emitAcc ?: 0f) + rate
        var n = floor(body.emitAcc!!).toInt()
        body.emitAcc = body.emitAcc!! - n.toFloat()
        while (n > 0) {
            n--
            val j = (env.rng() - 0.5f) * 0.6f // soft emission cone
            val h = body.heading.rotatedAboutZ(j)
            val speed = 2f + env.rng() * 2f
            val sp = Particle(position = body.center, velocity = h * speed, heat = 0.6f)
            sp.age = life
            env.spawn(sp)
        }
    }
}

private const val RESONATE_OMEGA = 3f

/** §20.3 — `resonate`: a modifier that pulses siblings with 1 + sin(ω·t) — a well that breathes. */
class ResonateForce : Force {
    override val token = "resonate"
    override val label = "Resonate"
    override val hasModify = true
    override fun apply(body: Body, particle: Particle, env: Env) {} // pure modifier
    override fun modify(body: Body, particle: Particle, env: Env): ForceModification =
        ForceModification(strength = 1f + sin(env.t * RESONATE_OMEGA * body.spin))
}

private const val SPOTLIGHT_COS = 0.5f

/** §20.3 — `spotlight`: a modifier that gates siblings to an angular cone of the heading (half-angle ~60°). */
class SpotlightForce : Force {
    override val token = "spotlight"
    override val label = "Spotlight"
    override val hasModify = true
    override fun apply(body: Body, particle: Particle, env: Env) {} // pure modifier
    override fun modify(body: Body, particle: Particle, env: Env): ForceModification {
        val dir = (env.vector / env.dist) * -1f // body → particle
        return ForceModification(gate = dir.dot(body.heading) < SPOTLIGHT_COS)
    }
}

/**
 * Workover v0.3 — `screen`: a quiet zone that damps OTHER bodies' forces on matter inside its range.
 * Cross-body by definition, so the work lives in the integrator's force pass; `apply` is a no-op.
 */
class ScreenForce : Force {
    override val token = "screen"
    override val label = "Screen"
    override fun apply(body: Body, particle: Particle, env: Env) {} // attenuation in the integrator
}

/** §20.8 — `pigment`: conserved color transport. Matter overlapping a pigment body adopts its tint. */
class PigmentForce : Force {
    override val token = "pigment"
    override val label = "Pigment"
    override fun apply(body: Body, particle: Particle, env: Env) {
        val tint = body.tint ?: return
        if (env.dist >= body.range * 0.6f) return // only stains on overlap
        particle.color = particle.color?.let { mixHex(it, tint, 0.08f) } ?: tint
    }
}

private const val FIELDFLOW_STEER = 0.5f // fraction of velocity turned onto the line per frame (× gain)
private const val FIELDFLOW_ACCEL = 0.12f // streaming acceleration along the line (× gain)

/** §20.3 — `fieldflow`: follow the net structure field (via env.fieldAt) — steer onto it, stream down it. */
class FieldFlowForce : Force {
    override val token = "fieldflow"
    override val label = "Field Flow"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (body.range > 0f && env.dist >= body.range) return // range 0 ⇒ global
        val f = env.fieldAt?.invoke(particle.position) ?: return
        val mag = f.length()
        if (mag <= 1e-9f) return // a true null point — no line to follow
        val u = f / mag // the field-line tangent (direction only — scale-free)
        val falloff = if (body.range > 0f) 1f - env.dist / body.range else 1f
        val gain = body.strength * falloff
        val sp = particle.velocity.length()
        if (sp > 1e-6f) { // 1) STEER onto the line without spending speed
            val k = min(1f, gain * FIELDFLOW_STEER)
            particle.velocity += (u * sp - particle.velocity) * k
        }
        particle.velocity += u * (gain * FIELDFLOW_ACCEL) // 2) STREAM down the line
        clampToC(particle, env.c)
        if (body.isEngaged) particle.heat = max(particle.heat, falloff * 0.4f)
    }
}

/** §22.3 — `warp`: a wormhole throat. Matter entering (within absorbR) is relocated to the paired throat. */
class WarpForce : Force {
    override val token = "warp"
    override val label = "Warp"
    override val isKinematic = true
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (!body.warpHas || particle.cap != null) return
        val throat = body.absorbR
        if (env.dist >= throat) return
        val target = body.warpTarget ?: return
        val twist = body.twist ?: 0f
        val k = body.warpScale ?: 1f
        val u = (env.vector / env.dist) * -1f // entry direction (unit local offset)
        val ru = u.rotatedAboutZ(twist)
        val outR = throat * k + 6f // emerge just outside the paired throat
        particle.position = target + ru * outR
        particle.velocity = particle.velocity.rotatedAboutZ(twist) // carry momentum through, twisted
        particle.heat = max(particle.heat, 0.6f)
    }
}

/** The designed extended forces, in spec order (§20.3). */
fun extendedForces(): List<Force> = listOf(
    LensForce(), GateForce(), BuoyancyForce(), ShearForce(), CrystallizeForce(),
    AlignForce(), WindForce(), CohesionForce(), PressureForce(), LinkForce(),
    HuntForce(), MorphForce(), SpawnForce(), ResonateForce(), SpotlightForce(),
    ScreenForce(), PigmentForce(), FieldFlowForce(), WarpForce(),
)
