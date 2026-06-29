package com.fundamental.core.runtime

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.EnergyReport
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.engine.WaveStyle
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
// Overlay readings live in the `overlay` package (host-drawn), not on this facade.

// ── Mirror types for the missing JS FieldHandle surface ───────────────────────────────────────────────

/** Render modes for the field underlay — mirrors Swift `RenderMode`. */
enum class RenderMode(val id: String) {
    DOTS("dots"), TRAILS("trails"), LINKS("links"), METABALLS("metaballs"),
    VORONOI("voronoi"), STREAMLINES("streamlines"), NONE("none")
}

/** Wave center position source — mirrors Swift `WaveCenter`. */
sealed class WaveCenter {
    data class Coordinate(val x: Float, val y: Float, val z: Float = 0f) : WaveCenter()
    class Provider(val provider: () -> Vec3) : WaveCenter()
}

/** Additive overlay reading modes — mirrors Swift `OverlayMode`. */
enum class OverlayMode(val id: String) {
    OFF("off"), STREAMLINES("streamlines"), FORCE_VECTORS("forceVectors"),
    FIELD_LINES("fieldLines"), GRID("grid"), TEMPERATURE("temperature"),
    ENERGY("energy"), PATH("path"), DATA("data")
}

/** One or more additive overlay readings — mirrors Swift `OverlayInput`. */
sealed class OverlayInput {
    data class Single(val mode: OverlayMode) : OverlayInput()
    data class Stack(val modes: List<OverlayMode>) : OverlayInput()
}

/** Thread connector between two opaque body references — mirrors Swift `ThreadLink`. */
data class ThreadLink(val a: Any, val b: Any, val color: String? = null)

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

/** Direction of a declared relationship edge (`addEdge`). */
enum class EdgeDirection { FROM_TO, TO_FROM, BIDIRECTIONAL }

/**
 * A snapshot of a relationship edge at the moment [FieldHandle.readEdges] is called — immutable.
 * `from`/`to` are the endpoint bodies' carried `data`. `strength` ∈ [0,1] climbs ~1.5/s while the
 * source is salient and decays ~0.3/s idle; `memory` ∈ [0,1] is the slow longitudinal warmth (holds
 * while idle); `active` is whether the source body's density > 0.08 this tick.
 */
data class EdgeRecord(
    val from: Any?,
    val to: Any?,
    val type: String,
    val strength: Float,
    val memory: Float,
    val active: Boolean,
    val direction: EdgeDirection,
)

/** A live handle to a registered edge: mutate its strength/type, or remove it. */
class EdgeHandle internal constructor(
    private val setImpl: (Float?, String?) -> Unit,
    private val removeImpl: () -> Unit,
) {
    fun set(strength: Float? = null, type: String? = null) = setImpl(strength, type)
    fun remove() = removeImpl()
}

/** The public field handle — drive frames with [tick], render from [readParticles] / [particles]. */
class FieldHandle(val controller: FieldController) {

    // ── scanning (explicit rescan mirrors Swift scan/rescan) ──────────────────────────
    /** Re-sample programmatic body rects and reindex the particle hash — the explicit JS `scan()`. */
    fun scan() { for (b in controller.bodies) b.rect?.let { b.box = it() } }
    /** Alias of [scan]. */
    fun rescan() = scan()

    // ── formation + separation ────────────────────────────────────────────────────────
    fun setFormation(name: String) = controller.setFormation(name)
    /** Set the lateral repulsion strength between particles. Mirrors JS `setSeparation`. */
    fun setSeparation(strength: Float) { controller.separation = strength }

    var separation: Float
        // JvmName annotations avoid the JVM-level clash with fun setSeparation above.
        @JvmName("getSeparationValue") get() = controller.separation
        @JvmName("setSeparationValue") set(v) { controller.separation = v }

    // ── visual configuration (stored; Compose/View host reads to adapt its draw layer) ─
    private var _accent: String = "#4da3ff"
    /** Accent colour for the particle swarm (hex). Mirrors JS `setAccent`. */
    fun setAccent(hex: String) { _accent = hex }
    val accent: String get() = _accent

    private var _palette: List<String> = emptyList()
    /** Travelling-accent palette (the journey stops). Mirrors JS `setPalette`. */
    fun setPalette(palette: List<String>) { _palette = palette }
    val palette: List<String> get() = _palette

    private var _waveStyle: WaveStyle = WaveStyle.LINEAR
    /** Carrier-wave layout style. Mirrors JS `setWaveStyle`. */
    fun setWaveStyle(style: WaveStyle) { _waveStyle = style }
    val waveStyle: WaveStyle get() = _waveStyle

    private var _waveCenter: WaveCenter? = null
    /** Wave-center anchor for circular wave style. Mirrors JS `setWaveCenter`. */
    fun setWaveCenter(center: WaveCenter?) { _waveCenter = center }
    val waveCenter: WaveCenter? get() = _waveCenter

    private var _renderMode: RenderMode = RenderMode.NONE
    /** Render underlay mode. Mirrors JS `setRender`. Host reads this to select its draw path. */
    fun setRender(mode: RenderMode) { _renderMode = mode }
    val renderMode: RenderMode get() = _renderMode

    private var _overlay: OverlayInput = OverlayInput.Single(OverlayMode.OFF)
    /** Additive overlay readings. Mirrors JS `setOverlay`. Host reads this to draw diagnostics. */
    fun setOverlay(input: OverlayInput) { _overlay = input }
    val overlayInput: OverlayInput get() = _overlay

    private var _background: String? = null
    /** Background/canvas clear colour (hex or null = transparent). Mirrors JS `setBackground`. */
    fun setBackground(hex: String?) { _background = hex }
    val background: String? get() = _background

    private var _threads: List<ThreadLink>? = null
    /** Connector thread links. Mirrors JS `threads`. Host resolves and draws them. */
    fun threads(links: List<ThreadLink>?) { _threads = links }
    val threadLinks: List<ThreadLink>? get() = _threads

    private var _dprCap: Float = 2.5f
    /** Device-pixel-ratio cap — passed to the host's render surface. Mirrors JS `setDprCap`. */
    fun setDprCap(cap: Float) { _dprCap = cap }
    val dprCap: Float get() = _dprCap

    private var _qualityTier: Int = 0
    /**
     * Quality tier 0–3 (0 = full, 3 = paused). Mirrors JS `setQualityTier`. The host adapts its
     * draw complexity; the engine [QualityGovernor] equivalent lives in the platform layer.
     */
    fun setQualityTier(tier: Int) { _qualityTier = tier }
    val qualityTier: Int get() = _qualityTier

    private var _visible: Boolean = true
    /** Show/hide the field layer (host should skip its draw when false). Mirrors JS `setVisible`. */
    fun setVisible(on: Boolean) { _visible = on }
    val isVisible: Boolean get() = _visible

    private var _scrollV: Float = 0f
    /**
     * The eased scroll velocity fed by the Android host (pixels/frame at 60 Hz, equivalent to
     * JS `scrollV`). Call [feedScrollV] from a `RecyclerView`/`NestedScrollView` listener.
     */
    fun scrollV(): Float = _scrollV
    /** Feed the current frame's scroll velocity from the platform scroll listener. */
    fun feedScrollV(vel: Float) { _scrollV = vel }

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
        body.feedback = true // programmatic bodies measure density (§8) — Swift addBody parity (feedback: true)
        body.tint = spec.tint
        body.rect = spec.rect
        body.box = spec.rect()
        controller.addBody(body)
        return BodyHandle(controller, body, spec.data)
    }

    // ── data atoms, focus, open channels ─────────────────────────────────────────────
    fun seed(atoms: List<AtomPayload>) = controller.seed(atoms)
    fun atomAt(x: Float, y: Float, radius: Float = 24f): AtomPayload? = controller.atomAt(x, y, radius)

    private var _focused: Particle? = null

    /**
     * Focus the nearest particle to (x, y) — marks it in [focusedParticle] for the host to highlight.
     * Returns its atom payload (mirroring JS `focusAt` which returns `AtomPayload | null`).
     * Mirrors Swift `focusAt`.
     */
    fun focusAt(x: Float, y: Float): AtomPayload? {
        val at = Vec3(x, y, 0f)
        var best: Particle? = null
        var bestD = Float.MAX_VALUE
        for (p in controller.particles) {
            val dx = p.position.x - at.x; val dy = p.position.y - at.y
            val d = dx * dx + dy * dy
            if (d < bestD) { bestD = d; best = p }
        }
        _focused = best
        return best?.atom
    }

    /** Clear the focused particle marker. Mirrors JS/Swift `clearFocus`. */
    fun clearFocus() { _focused = null }

    /** The currently focused particle (for host highlighting), or null. Set by [focusAt]. */
    val focusedParticle: Particle? get() = _focused

    /**
     * Get or create a named [ScalarGrid] — the field-buffer substrate backing `diffuse`/`propagate`
     * forces. Grids are created lazily and shared with the force system. Mirrors JS `grid(name)`.
     */
    fun grid(name: String): ScalarGrid = controller.grid(name)

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

    // ── relationship edges (§addEdge) ──────────────────────────────────────────────────
    /**
     * Declare a directed relationship between two programmatic bodies (handles from [addBody]).
     * The edge strengthens while `from` is salient and decays idle; `memory` accretes. Removing
     * either endpoint body drops the edge. Returns an [EdgeHandle] to mutate/remove it live.
     */
    fun addEdge(
        from: BodyHandle,
        to: BodyHandle,
        type: String = "related",
        strength: Float = 0.5f,
        direction: EdgeDirection = EdgeDirection.FROM_TO,
    ): EdgeHandle = controller.addEdge(from.body, from.data, to.body, to.data, type, strength, direction)

    /** A live snapshot of all programmatic edges — the relationship read-out for a consumer. */
    fun readEdges(): List<EdgeRecord> = controller.readEdges()

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
