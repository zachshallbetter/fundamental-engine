package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
import com.fundamental.core.math.hexToRgb
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

// Micro-reactions (§23) — the Kotlin port of swift/Sources/FundamentalCore/Engine/Reactions.swift.
// "Energy isn't lost — it's spent on spectacle." (§23.1)
//
// The pure §23 helpers below (energyDelta … captureEdge) mirror Reactions.swift line-for-line. The
// Spark type + spark pool (emission, decay, cap) live host-side in Swift — Registry.swift's `Spark`
// struct and FundamentalVanilla/FieldEngine.swift's spawnSpark + per-frame decay — and are gathered
// here as a faithful, host-agnostic `SparkPool` so the engine package owns the §23 micro-reaction
// matter exactly as Swift does.

// MARK: - Color constants (§20.8)
// RGB is a Vec3 of [0,255] channels, exactly as Swift aliases `RGB = SIMD3<Float>`. Mirror of
// swift/Sources/FundamentalCore/Math/Math.swift's WARM/COOL.

/** Cool (resting) particle color (§20.8). Warm-default identity — parity with the JS core. */
val COOL: Vec3 = Vec3(255f, 224f, 200f)

/** Warm (energized) particle color (§20.8). Warm-default identity — parity with the JS core. */
val WARM: Vec3 = Vec3(255f, 110f, 80f)

// MARK: - Micro-reactions (§23)

/** Kinetic energy removed at an interaction: ½·m·(|v_before|² − |v_after|²) (§23.2). */
fun energyDelta(m: Float, vBefore: Float, vAfter: Float): Float =
    0.5f * m * (vBefore * vBefore - vAfter * vAfter)

/** Reaction intensity from removed energy: clamp(k·ΔE, 0, iMax) (§23.2). */
fun reactionIntensity(dE: Float, k: Float = 1f, iMax: Float = 2.4f): Float =
    clamp(k * dE, 0f, iMax)

/** Spark count for a reaction of a given power (§23.3, the wall exemplar). */
fun sparkCount(power: Float, rand: () -> Float = { Random.nextFloat() }): Int =
    3 + (rand() * (if (power > 0f) power else 1f) * 3f).toInt()

/**
 * The recoil impulse on the *other* agent in a transfer — equal-and-opposite,
 * split by its mass: Δv = −Δp / m (§23.5). A heavier agent barely budges.
 */
fun recoilImpulse(dp: Vec3, mOther: Float): Vec3 {
    val m = if (mOther > 0f) mOther else 1f
    return (dp / m) * -1f
}

/**
 * A discrete radial burst impulse (§11) — the velocity kick and heat a one-shot `burst(at:)`
 * imparts to matter at offset `delta` from the blast, falling off linearly to nothing at radius
 * `r`; outside `r` it's inert.
 */
fun burstImpulse(delta: Vec3, r: Float, power: Float = 6f): BurstImpulse {
    val d = max(delta.length(), 1f)
    if (d >= r) return BurstImpulse(Vec3.ZERO, 0f)
    val falloff = 1f - d / r
    return BurstImpulse((delta / d) * (falloff * power), falloff * 0.9f)
}

/** Result of [burstImpulse] — the Swift tuple `(dv: Vec3, heat: Float)`. */
data class BurstImpulse(val dv: Vec3, val heat: Float)

// MARK: - Accretion (§6.9)

/**
 * Release exactly the particles a body captured: eject each just **past** the absorption radius
 * along a random bearing, give it a radial outward velocity, clear its capture + heat to 1, and
 * reset the body's load to 0. Held matter is **conserved** — released particles stay in the
 * caller's pool. Returns the released particles (in pool order). `rng` is injectable for
 * deterministic tests.
 *
 * Ejecting past `absorbR` (not at the core) is what makes a supernova a real cycle: matter dropped
 * at the core sits *inside* the capture radius and is re-grabbed on the very next frame,
 * degenerating the explosion into a per-frame strobe whose blast progressively evacuates the
 * catchment until the sink goes dormant. Leaving the accretion zone lets a `sink+attract` well reel
 * the ejecta back for a genuine fill → explode → fall-back → refill cycle (a lone `sink` simply
 * lets it disperse).
 */
fun releaseCaptured(
    particles: List<Particle>,
    from: Body,
    rng: () -> Float = { Random.nextFloat() },
): List<Particle> {
    val released = ArrayList<Particle>()
    val rim = from.absorbR + 6f // clear the capture horizon so it isn't re-captured next frame
    for (q in particles) {
        if (q.cap !== from) continue
        val ang = rng() * Math.PI.toFloat() * 2f
        val spd = 4f + rng() * 3f
        q.cap = null
        q.position = from.center + Vec3(cos(ang) * rim, sin(ang) * rim, 0f)
        q.velocity = Vec3(cos(ang) * spd, sin(ang) * spd, 0f)
        q.heat = 1f
        // a supernova is a CONSERVATION event: the ejected matter rejoins the persistent field.
        // Mortal (source-spawned) matter that a sink captured and held is released immortal — so a
        // source→sink→supernova loop visibly conserves (the matter the source made becomes lasting
        // field matter, bounded by the engine's pool ceiling), instead of the released particles
        // aging out and vanishing moments later. A no-op for the canonical immortal base pool (age
        // is already null).
        q.age = null
        released.add(q)
    }
    from.accreted = 0f
    return released
}

/** Sink fill fraction ∈ [0,1] — the value written to the `load` feedback lane. 0 when not a sink. */
fun sinkLoad(b: Body): Float {
    if (b.capacity <= 0f) return 0f
    return clamp(b.accreted / b.capacity, 0f, 1f)
}

/** Capture/release event edge for a sink body (§22.5). Pure: the caller persists `armed`. */
enum class CaptureEvent { CAPTURED, RELEASED }

/** Result of [captureEdge] — the Swift tuple `(fire: CaptureEvent?, armed: Bool)`. */
data class CaptureEdge(val fire: CaptureEvent?, val armed: Boolean)

fun captureEdge(prevArmed: Boolean, accreting: Boolean): CaptureEdge {
    if (accreting && !prevArmed) return CaptureEdge(CaptureEvent.CAPTURED, true)
    if (!accreting && prevArmed) return CaptureEdge(CaptureEvent.RELEASED, false)
    return CaptureEdge(null, prevArmed)
}

// MARK: - Sparks (§23) — engine-owned pool, renderer-drawn

/**
 * A spark — a micro-reaction particle (§23). Engine-owned pool, renderer-drawn. Mirror of Swift's
 * `Spark` (swift/Sources/FundamentalCore/Engine/Registry.swift). `color` is an RGB (Vec3) of
 * [0,255] channels.
 */
class Spark(
    var position: Vec3,
    var velocity: Vec3,
    /** 1 → 0. */
    var life: Float,
    var color: Vec3,
)

/**
 * The capped spark pool (§23) — the host-side spark machinery of FundamentalVanilla's FieldEngine
 * (`spawnSpark` + the per-frame decay), gathered into a host-agnostic engine type. `emit` is wired
 * to `Env.spark`; `update` is called once per frame by the integrator/host.
 */
class SparkPool(private val rng: () -> Float = { Random.nextFloat() }) {
    private val _sparks = ArrayList<Spark>()
    val sparks: List<Spark> get() = _sparks

    val count: Int get() = _sparks.size

    /** Spark pool (§23) — capped, skipped under reduced motion. */
    fun emit(at: Vec3, power: Float, color: String?, prefersReducedMotion: Boolean = false) {
        if (prefersReducedMotion || _sparks.size > 260) return
        val c: Vec3 = color?.let { hexToRgb(it) } ?: WARM
        val n = sparkCount(power, rng)
        for (i in 0 until n) {
            val a = rng() * 6.28318f
            val s = 0.8f + rng() * (if (power > 0f) power else 1f) * 1.7f
            _sparks.add(Spark(position = at, velocity = Vec3(cos(a) * s, sin(a) * s, 0f), life = 1f, color = c))
        }
    }

    /** Spark decay (§23) — drift, damp, fade, drop. */
    fun update() {
        if (_sparks.isEmpty()) return
        for (i in _sparks.indices) {
            _sparks[i].position += _sparks[i].velocity
            _sparks[i].velocity *= 0.92f
            _sparks[i].life -= 0.04f
        }
        _sparks.removeAll { it.life <= 0f }
    }

    fun clear() = _sparks.clear()
}
