package com.fundamental.core.runtime

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.EnergyReport
import com.fundamental.core.engine.energyReport
import com.fundamental.core.math.Vec3
import kotlin.math.cos
import kotlin.math.sin

// The public field API — the Kotlin counterpart of Swift's `FieldHandle` protocol / `FieldField`, scoped
// to the engine's shipped capabilities. A thin, ergonomic facade over [FieldController]: add programmatic
// bodies (with live handles), burst, lead the flow, seed data atoms, open scalar channels, and read the
// pool out. Hosts (Compose, the desktop lab) can use the lower-level FieldController directly; consumers
// integrating the engine use this.
//
// Not yet exposed (their subsystems aren't ported): relationship edges, sampleScalar/Gradient (heatmap),
// overlay readings, and the attention/causality toggles.

/** The readParticles buffer layout: 5 floats per particle (x, y, z, heat, size). */
const val PARTICLE_STRIDE: Int = 5

/** The wire-format version of the readParticles buffer. */
const val PARTICLE_WIRE_VERSION: Int = 0

/** Spec for a programmatic body (no backing view). `rect` is sampled each frame; `angleDeg` in degrees. */
class BodySpec(
    val tokens: List<String>,
    val strength: Float = 1f,
    val range: Float = 100f,
    val spin: Float = 1f,
    val angleDeg: Float? = null,
    val tint: String? = null,
    val data: Any? = null,
    val rect: () -> Box,
)

/** A live handle to a programmatic body: mutate its params, read its sink load, or remove it. */
class BodyHandle internal constructor(
    private val controller: FieldController,
    internal val body: Body,
    val data: Any?,
) {
    /** Mutate force params live (only the ones you pass). `angleDeg` re-aims the heading. */
    fun set(strength: Float? = null, range: Float? = null, angleDeg: Float? = null, spin: Float? = null, tint: String? = null) {
        strength?.let { body.strength = it }
        range?.let { body.range = it }
        spin?.let { body.spin = it }
        tint?.let { body.tint = it }
        angleDeg?.let {
            val r = Math.toRadians(it.toDouble())
            body.heading = Vec3(cos(r).toFloat(), sin(r).toFloat(), 0f)
        }
    }

    /** Current sink load: absorbed / capacity ∈ [0,1]. Zero if the body has no `sink` token. */
    val load: Float get() = if (body.capacity > 0f) (body.accreted / body.capacity).coerceIn(0f, 1f) else 0f

    /** Drain stored accretion and return the raw absorbed count; the body begins accumulating again. */
    fun drain(): Float {
        val n = body.accreted
        body.accreted = 0f
        return n
    }

    fun remove() = controller.removeBody(body)
}

/** A live handle to a registered scalar field channel. */
class FieldChannelHandle internal constructor(private val controller: FieldController, val name: String) {
    fun set(sampler: (Float, Float) -> Float) = controller.addFieldChannel(name, sampler)
    fun remove() = controller.removeFieldChannel(name)
}

/** The public field handle — drive frames with [tick], render from [readParticles] / [particles]. */
class FieldHandle(val controller: FieldController) {

    fun setFormation(name: String) = controller.setFormation(name)

    var separation: Float
        get() = controller.separation
        set(v) { controller.separation = v }

    // ── imperative interactions ──────────────────────────────────────────────────────
    fun burst(x: Float, y: Float, power: Float = 1f) = controller.burst(x, y, power)
    fun flowTo(x: Float, y: Float, strength: Float? = null, radius: Float? = null) = controller.flowTo(x, y, strength, radius)
    fun clearFlow() = controller.clearFlow()

    // ── programmatic bodies ──────────────────────────────────────────────────────────
    fun addBody(spec: BodySpec): BodyHandle {
        val heading = spec.angleDeg?.let {
            val r = Math.toRadians(it.toDouble()); Vec3(cos(r).toFloat(), sin(r).toFloat(), 0f)
        } ?: Vec3(0f, -1f, 0f)
        val body = Body(tokens = spec.tokens, strength = spec.strength, range = spec.range, spin = spec.spin, heading = heading)
        body.tint = spec.tint
        body.rect = spec.rect
        body.box = spec.rect()
        controller.addBody(body)
        return BodyHandle(controller, body, spec.data)
    }

    // ── data atoms + open channels ───────────────────────────────────────────────────
    fun seed(atoms: List<AtomPayload>) = controller.seed(atoms)
    fun atomAt(x: Float, y: Float, radius: Float = 24f): AtomPayload? = controller.atomAt(x, y, radius)
    fun addField(name: String, sampler: (Float, Float) -> Float): FieldChannelHandle {
        controller.addFieldChannel(name, sampler)
        return FieldChannelHandle(controller, name)
    }
    fun sampleField(name: String, x: Float, y: Float): Float = controller.sampleField(name, x, y)

    // ── Body-Matter-Interaction toggles (§2.4 / Concept 4 / H1) ──────────────────────
    fun setAttention(on: Boolean) { controller.attentionEnabled = on }
    fun setCausality(on: Boolean) { controller.causalityEnabled = on }
    fun setHeatmap(on: Boolean) { controller.heatmapEnabled = on }
    /** Carrier waves — the ambient resting structure + the bound shimmer reservoir (§2.3 / §24). */
    fun setWaves(on: Boolean) { controller.wavesEnabled = on }
    /** Normalized heatmap density ∈ [0,1] at a point (requires `setHeatmap(true)`). */
    fun sampleScalar(x: Float, y: Float): Float = controller.sampleScalar(x, y)
    /** Heatmap density gradient at a point (up-slope toward denser matter). */
    fun sampleGradient(x: Float, y: Float): Vec3 = controller.sampleGradient(x, y)

    // ── observability ────────────────────────────────────────────────────────────────
    fun particleCount(): Int = controller.particleCount
    fun energy(): EnergyReport = energyReport(controller.particles)
    fun readParticles(out: FloatArray): Int = controller.readParticles(out)

    // ── lifecycle ────────────────────────────────────────────────────────────────────
    fun tick(dt: Float = 1f) = controller.tick(dt)
    fun destroy() { controller.clearFlow() }
}

/** Create a field handle over a fresh controller — the Kotlin `createField`. */
fun createField(
    width: Float,
    height: Float,
    depth: Float = 0f,
    particleCount: Int = 300,
    seed: Long? = null,
): FieldHandle = FieldHandle(FieldController(width, height, depth, particleCount, seed))
