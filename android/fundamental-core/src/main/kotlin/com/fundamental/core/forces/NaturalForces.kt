package com.fundamental.core.forces

import com.fundamental.core.engine.AxisBox
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Force
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Pole
import com.fundamental.core.engine.dipoleField
import com.fundamental.core.engine.polePair
import com.fundamental.core.math.EPS
import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

// Natural primitives (§20.10) — the Kotlin port of swift/Sources/FundamentalCore/Forces/NaturalForces.swift.
// Real field laws (true softened inverse-square), not the designed UI falloffs. Opt-in via tokens.
//
// gravity/charge/magnetism are deterministic and exactly testable; thermal (RNG), collide (neighbors),
// and the grid-backed three (diffuse/propagate/memory) are verified behaviorally against a constructed Env.
//
// The visual `field()` structure hooks (the dipole/monopole renderable fields) are implemented for the
// monopole sources (gravity, charge); magnetism's dipole field defers to the geometry/integrator port.

/** Charged elements radiate up to (1 + Q_GAIN)× their base field as they charge up (Stage C2). */
private const val Q_GAIN: Float = 1.5f
private const val DIPOLE_MIN_SEP: Float = 8f // below this the box gives no usable dipole axis
private const val DIPOLE_MIN_REACH: Float = 60f // synthesized pole reach floor (point bodies)

private val TWO_PI: Float = (2.0 * PI).toFloat()

/** Clamp a particle's speed to the unit system's `c` — the in-sim speed of light (§20.10). */
fun clampToC(p: Particle, c: Float) {
    val sp = p.velocity.length()
    if (sp > c) p.velocity *= c / sp
}

/**
 * The shared softened inverse-square kernel (§20.10): `s / (d² + ε²)` along the unit vector toward the
 * body, then clamp speed to `c`. Plummer softening ε = r_s = 2GM/c² keeps it finite at the core.
 */
fun inverseSquare(b: Body, p: Particle, e: Env, s: Float) {
    if (e.dist >= b.range) return
    val rs = (2f * e.G * b.M) / (e.c * e.c) // Schwarzschild radius → softening ε
    val f = s / (e.dist * e.dist + rs * rs)
    p.velocity += (e.vector / e.dist) * f
    clampToC(p, e.c)
}

/** The Langevin noise amplitude σ = √(2T); negative T floored to 0. */
fun thermalSigma(t: Float): Float = sqrt(2f * max(0f, t))

/** The inward radial gravitational field at a world point (Stage B) — always toward the mass. */
private fun bodyGravityField(b: Body, point: Vec3): Vec3 {
    val d3 = b.center - point // toward the body — gravity attracts
    val d = max(d3.length(), EPS)
    val mag = (b.M * (1f + Q_GAIN * b.d)) / (d * d)
    return (d3 / d) * mag
}

/**
 * The body's dipole field at a world point (Stage B): the two-pole superposition scaled by `s`. Shared
 * by magnetism (the bar magnet) and charge's dipole rendering. Synthesizes poles when the box gives no
 * usable separation, so every source reads as a dipole regardless of size.
 */
private fun bodyDipole(b: Body, point: Vec3, s: Float): Vec3 {
    var (a, c) = polePair(AxisBox(b.box, b.heading, b.spin))
    val sep = (a.position - c.position).length()
    if (sep < max(b.range * 0.06f, DIPOLE_MIN_SEP)) {
        val half = max(b.range * 0.18f, DIPOLE_MIN_REACH)
        val sgn = if (b.spin < 0f) -1f else 1f
        a = Pole(b.center + b.heading * half, sgn)
        c = Pole(b.center - b.heading * half, -sgn)
    }
    val sq = s * (1f + Q_GAIN * b.d) // charged elements radiate a stronger field
    return dipoleField(listOf(a, c), point) * sq
}

/** The radial monopole field of a single point charge (§20.3): out of +, into −. */
private fun bodyMonopole(b: Body, point: Vec3, s: Float): Vec3 {
    val d3 = point - b.center
    val d = max(d3.length(), EPS)
    val sgn = if (b.spin < 0f) -1f else 1f
    val mag = (sgn * s * (1f + Q_GAIN * b.d)) / (d * d)
    return (d3 / d) * mag
}

/** §20.10 — true softened inverse-square: F = GM·d̂/(d²+ε²), always attractive. */
class GravityForce : Force {
    override val token = "gravity"
    override val label = "Gravity"
    override fun apply(body: Body, particle: Particle, env: Env) =
        inverseSquare(body, particle, env, env.G * body.M) // GM, mass-sourced

    override fun field(body: Body, at: Vec3): Vec3 = bodyGravityField(body, at)
}

/** §20.3/§20.10 — the signed sibling of gravity; same kernel, sign sets direction. */
class ChargeForce : Force {
    override val token = "charge"
    override val label = "Charge"
    override fun apply(body: Body, particle: Particle, env: Env) {
        val q = particle.charge ?: 0f // neutral matter ignores charge fields
        if (q == 0f) return
        // F = σ·q·GM/(d²+ε²); negated for the inward kernel so like signs repel.
        inverseSquare(body, particle, env, -(body.spin * q * env.G * body.M))
    }

    override fun field(body: Body, at: Vec3): Vec3 = bodyMonopole(body, at, body.M)
}

/**
 * §20.10 — the Lorentz force on a moving charge: curves the path without doing work (speed preserved,
 * only the heading turns). Implemented as an exact rotation about the plane axis by θ = q·spin·B·falloff.
 */
class MagnetismForce : Force {
    override val token = "magnetism"
    override val label = "Magnetism"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val q = particle.charge ?: 0f
        if (q == 0f) return // the Lorentz force needs charge
        val falloff = 1f - env.dist / body.range // ∈ (0, 1] inside the region
        val theta = q * body.spin * body.strength * falloff
        particle.velocity = particle.velocity.rotatedAboutZ(theta)
    }

    /** The dipole structure of B (Stage B). Particles curve perpendicular to it, not along it. */
    override fun field(body: Body, at: Vec3): Vec3 = bodyDipole(body, at, body.strength)
}

/**
 * §20.10 — `thermal`: Langevin/Brownian agitation. Each frame a charge-free Gaussian kick v += σ·ξ
 * jiggles matter, σ = √(2T). Box–Muller turns two uniforms into one isotropic kick.
 */
class ThermalForce : Force {
    override val token = "thermal"
    override val label = "Thermal"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val falloff = 1f - env.dist / body.range // hotter nearer the source
        val sigma = thermalSigma(body.strength * falloff)
        if (sigma == 0f) return
        val u1 = max(Random.nextFloat(), 1e-9f) // avoid log(0)
        val mag = sigma * sqrt(-2f * ln(u1))
        val ang = TWO_PI * Random.nextFloat()
        var v = particle.velocity
        v = Vec3(v.x + mag * cos(ang), v.y + mag * sin(ang), v.z)
        if (env.volume.z > 0f) {
            val u2 = max(Random.nextFloat(), 1e-9f)
            v = Vec3(v.x, v.y, v.z + sigma * sqrt(-2f * ln(u2)) * cos(TWO_PI * Random.nextFloat()))
        }
        particle.velocity = v
        if (body.isEngaged) particle.heat = max(particle.heat, falloff * 0.4f)
        clampToC(particle, env.c)
    }
}

/**
 * §20.10 — `collide`: elastic pairwise collision. For each approaching, overlapping neighbour the pair
 * exchanges normal momentum symmetrically in one pass — momentum-conserving and order-independent.
 */
class CollideForce : Force {
    override val token = "collide"
    override val label = "Collide"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val restitution = com.fundamental.core.math.clamp(body.strength, 0f, 1f)
        val pr = max(1f, particle.size)
        for (q in env.neighbors(particle, pr * 4f)) {
            val qr = max(1f, q.size)
            val n = particle.position - q.position
            val d = n.length()
            if (d >= pr + qr || d < 1e-6f) continue // not in contact
            val u = n / d
            val relN = (particle.velocity - q.velocity).dot(u)
            if (relN >= 0f) continue // separating already → no impulse
            val j = (1f + restitution) * 0.5f * relN
            particle.velocity -= u * j
            q.velocity += u * j
        }
    }
}

/**
 * §20.10 — `diffuse` (over the scalar `diffuse` grid): the pheromone/stigmergy field. Lay a mark, then
 * steer up the blurred gradient toward where matter has gathered. `strength` sets deposit + follow gain.
 */
class DiffuseForce : Force {
    override val token = "diffuse"
    override val label = "Diffuse"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val g = env.grid("diffuse")
        g.deposit(particle.position, body.strength) // lay a mark
        val grad = g.gradient(particle.position) // follow the blurred trail up-gradient
        particle.velocity += grad * body.strength
    }
}

/** Frames between emitted shocks while a propagate body is engaged. */
private const val WAVE_PULSE_PERIOD = 12

/** How hard a passing wavefront carries matter outward (radiation pressure gain). */
private const val WAVE_PUSH: Float = 7f

/**
 * §20.10 — `propagate` (over a wave-mode grid): a travelling disturbance, ∂²φ/∂t² = c²∇²φ. An engaged
 * body injects an impulsive shock at its centre once per period; matter rides the front out.
 */
class PropagateForce : Force {
    override val token = "propagate"
    override val label = "Propagate"

    override fun source(body: Body, env: Env) {
        if (!body.isEngaged) return // only an engaged body emits
        if (env.frameN % WAVE_PULSE_PERIOD != 0) return // a shock train, once per period
        env.grid("wave-propagate").deposit(body.center, body.strength) // 'wave…' → wave stepping
    }

    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val g = env.grid("wave-propagate")
        val grad = g.gradient(particle.position)
        val act = grad.length() // wavefront activity — steep where a front is passing
        if (act < 1e-6f) return // no front here → coast
        val u = (env.vector / env.dist) * -1f // ride the front: radially OUTWARD
        particle.velocity += u * (act * body.strength * WAVE_PUSH)
        clampToC(particle, env.c)
    }
}

/**
 * §20.10 — `memory` (over a slow-decaying grid): the field remembers. Lay occupancy where matter sits;
 * the body's pull is amplified by how worn the spot is — frequently-travelled routes pull harder.
 */
class MemoryForce : Force {
    override val token = "memory"
    override val label = "Memory"
    override fun apply(body: Body, particle: Particle, env: Env) {
        if (env.dist >= body.range) return
        val g = env.grid("memory") // 'memory' name → slow-decay stepping
        g.deposit(particle.position, body.strength * 0.15f) // wear the path
        val amp = 1f + 0.5f * g.sample(particle.position) // worn paths pull harder (1 + μ·M)
        val f = (1f - env.dist / body.range).pow(2f) * body.strength * 0.5f * amp
        particle.velocity += (env.vector / env.dist) * f
    }
}

/** The natural primitives, in spec order (§20.10). */
fun naturalForces(): List<Force> = listOf(
    GravityForce(), ChargeForce(), MagnetismForce(), ThermalForce(), CollideForce(),
    DiffuseForce(), PropagateForce(), MemoryForce(),
)
