package com.fundamental.core.runtime

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.EnergyReport
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.engine.FieldPolicy
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.engine.WaveStyle
import com.fundamental.core.engine.energyReport
import com.fundamental.core.math.Vec3
import java.util.UUID
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

// ── Event bus types ────────────────────────────────────────────────────────────────────────────────

/** Field lifecycle events for the subscription bus. Mirrors Swift `FieldEvent`. */
enum class FieldEvent { TICK, BODY_ADD, BODY_REMOVE, PARTICLE_CAPTURE, SUPERNOVA }

/** Payload delivered to `on` subscribers. Mirrors Swift `FieldEventPayload`. */
data class FieldEventPayload(
    val event: FieldEvent,
    val body: Body? = null,
    val particle: Particle? = null,
)

/** Live subscription returned by [FieldHandle.on]. Call [cancel] to unsubscribe. */
class Subscription internal constructor(private val _cancel: () -> Unit) {
    fun cancel() = _cancel()
}

// ── Overlay renderer ───────────────────────────────────────────────────────────────────────────────

/**
 * A named overlay renderer registered via [FieldHandle.registerOverlay]. The host frame loop
 * calls [render] after the underlay draw each frame. Mirrors Swift `OverlayRenderer`.
 */
interface OverlayRenderer {
    fun render(handle: FieldHandle)
}

// ── Agent types ────────────────────────────────────────────────────────────────────────────────────

/**
 * Spec for an autonomous field-agent consumer. [position] reports the agent's world location each
 * tick; [onInfluence] receives the net force vector the field exerts there. Mirrors JS `AgentSpec`.
 */
class AgentSpec(
    val position: () -> Vec3,
    val range: Float = 120f,
    val tokens: List<String> = emptyList(),
    val onInfluence: ((Vec3) -> Unit)? = null,
)

/**
 * Handle returned by [FieldHandle.addAgent]. Call [remove] to deregister. Mirrors JS `AgentHandle`.
 */
class AgentHandle internal constructor(val spec: AgentSpec, private val _remove: () -> Unit) {
    fun remove() = _remove()
}

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
    /**
     * FIRST-CLASS IDENTITY for this programmatic body (JS #884). Supply a stable [FieldBodyIdentity]
     * (unique `id` in the field, plus optional namespace/kind/host) so consumers can reference the body
     * by identity rather than the returned handle. Omitted ⇒ the engine derives a synthetic `body-N`.
     */
    val identity: FieldBodyIdentity? = null,
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

    /** This body's resolved FIRST-CLASS IDENTITY (JS #884) — supplied, or derived + cached on first key. */
    val identity: FieldBodyIdentity get() = controller.bodyIdentity(body)

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

    // ── runtime FIELD POLICY (JS #892) ─────────────────────────────────────────────────
    /**
     * Replace the runtime [FieldPolicy] — what this host/session/user/app PERMITS. Reduced-motion always
     * wins (a policy can lower motion but never raise it above what reduced-motion allows). Mirrors JS
     * `setPolicy`.
     */
    fun setPolicy(policy: FieldPolicy) = controller.setPolicy(policy)
    /** The live runtime policy. Mirrors JS `policy`. */
    val policy: FieldPolicy get() = controller.policy
    /**
     * Feed the host's reduced-motion preference (the Kotlin analog of the JS host's `reducedMotion()` —
     * the controller is host-agnostic, so the platform/host feeds it like scroll). When true, motion
     * clamps to 0 regardless of policy.
     */
    fun feedReducedMotion(on: Boolean) { controller.reducedMotion = on }
    /** The effective motion allowance `0..1` this frame — reduced-motion + policy folded (JS #892). */
    fun effectiveMotion(): Float = controller.effectiveMotion()

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
        body.identity = spec.identity // supplied identity overrides derivation (JS #884)
        body.rect = spec.rect
        body.box = spec.rect()
        controller.addBody(body, spec.data)
        fireEvent(FieldEvent.BODY_ADD, FieldEventPayload(FieldEvent.BODY_ADD, body = body))
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

    /**
     * Map the live edges into identity-keyed [FieldRelationshipReading]s — the shared read behind
     * [query] and [snapshot] (diff/replay inherit it through the snapshots they compare). Endpoints
     * are the bodies' first-class identity ids (the JS `bodyId(e.from)` / Swift
     * `resolveIdentity(from).id`), NOT the edge's opaque carried `data` — so a reading keys the same
     * across planes and joins against the `bodies` lane's `id`s.
     */
    private fun relationshipReadings(): List<FieldRelationshipReading> =
        controller.liveEdges().map { e ->
            FieldRelationshipReading(
                from = controller.bodyIdentity(e.from).id,
                to = controller.bodyIdentity(e.to).id,
                type = e.type,
                strength = e.strength,
                memory = e.memory,
                active = e.active,
                causal = e.active,
            )
        }

    // ── observability ────────────────────────────────────────────────────────────────
    fun particleCount(): Int = controller.particleCount
    fun energy(): EnergyReport = energyReport(controller.particles)
    fun readParticles(out: FloatArray): Int = controller.readParticles(out)

    /**
     * Fill [out] with the stable integer ID of each live particle; return the particle count.
     * IDs are assigned at pool creation and survive body rebinding. Mirrors JS `readParticleIds`.
     */
    fun readParticleIds(out: IntArray): Int {
        val parts = controller.particles
        val n = minOf(parts.size, out.size)
        for (i in 0 until n) out[i] = parts[i].id
        return parts.size
    }

    /**
     * Sample each named scalar grid at every live particle's position and pack the results into
     * [out] (stride = `names.size`). Returns the particle count. Mirrors JS `readParticleChannels`.
     */
    fun readParticleChannels(names: List<String>, out: FloatArray): Int {
        val parts = controller.particles
        val stride = names.size
        for (i in parts.indices) {
            val base = i * stride
            if (base + stride > out.size) return parts.size
            for (j in names.indices) out[base + j] = controller.grid(names[j]).sample(parts[i].position)
        }
        return parts.size
    }

    /**
     * Net force vector a free particle at (x, y) would experience from all active bodies.
     * Uses the same [forceAt] probe the streamlines overlay draws. Safe to call between ticks.
     * Mirrors JS `sample(x, y)`.
     */
    fun sample(x: Float, y: Float): Vec3 = controller.sample(x, y)

    // ── substrate READ API: query (JS #837 / critical-path 02) ─────────────────────────
    /**
     * Ask the live field a structured, READ-ONLY question — which bodies are here, what they're doing,
     * how the field measures right now. Mirror of the JS `@fundamental-engine/core` `query()`; the result
     * [FieldQueryResult] has the same field names + shape so a reading is identical across planes.
     *
     * A `null` query is a global query (whole field, default include set). A [FieldQueryAt.Point] (with a
     * radius, default 240) or [FieldQueryAt.Rect] scopes to a region — only bodies whose centre falls in
     * the region are returned, and `influences` becomes meaningful (though empty in this port until the
     * impulse accumulator lands). `include` filters the sections; omitted ⇒ bodies + metrics +
     * relationships (plus influences for a local query).
     *
     * Read-only throughout: `query()` never mutates field state.
     */
    fun query(q: FieldQuery? = null): FieldQueryResult {
        val query = q ?: FieldQuery()
        val at = query.at
        val local = at != null

        // Resolve the region + local test (mirror of the JS point/rect/global branches).
        val region: FieldRect?
        val inRegion: (Body) -> Boolean
        when (at) {
            is FieldQueryAt.Rect -> {
                region = FieldRect(at.x, at.y, at.width, at.height)
                inRegion = { b ->
                    val c = b.box.center
                    c.x >= at.x && c.x <= at.x + at.width && c.y >= at.y && c.y <= at.y + at.height
                }
            }
            is FieldQueryAt.Point -> {
                val r = at.radius
                region = FieldRect(at.x - r, at.y - r, r * 2f, r * 2f)
                inRegion = { b ->
                    val c = b.box.center
                    kotlin.math.hypot((c.x - at.x).toDouble(), (c.y - at.y).toDouble()).toFloat() <= r
                }
            }
            null -> {
                region = null
                inRegion = { true }
            }
        }

        // Default include set: bodies + metrics + relationships, plus influences for a local query.
        val want = query.include ?: if (local)
            setOf(FieldQueryInclude.BODIES, FieldQueryInclude.METRICS, FieldQueryInclude.RELATIONSHIPS, FieldQueryInclude.INFLUENCES)
        else
            setOf(FieldQueryInclude.BODIES, FieldQueryInclude.METRICS, FieldQueryInclude.RELATIONSHIPS)

        val matched = controller.bodies.filter(inRegion)

        val bodyReadings: List<FieldBodyReading> = if (want.contains(FieldQueryInclude.BODIES)) {
            matched.map { b ->
                val identity = controller.bodyIdentity(b)
                val c = b.box.center
                FieldBodyReading(
                    id = identity.id,
                    identity = identity,
                    rect = FieldRect(c.x - b.box.hw, c.y - b.box.hh, b.box.hw * 2f, b.box.hh * 2f),
                    tokens = b.tokens.toList(),
                    metrics = buildMap {
                        put("density", b.d)
                        put("count", b.count)
                        put("engaged", if (b.isEngaged) 1f else 0f)
                        if (b.capacity > 0f) put("load", (b.accreted / b.capacity).coerceIn(0f, 1f))
                    },
                    // The port has no measured field-dimension lane yet — empty, matching the JS field name.
                    dimensions = emptyMap(),
                    activeFormations = listOf(controller.formationName),
                    // No body-authority lane in the port yet — fixed "anchored", the JS default.
                    authority = "anchored",
                )
            }
        } else emptyList()

        val metrics: Map<String, Float> = if (want.contains(FieldQueryInclude.METRICS)) {
            buildMap {
                put("particles", controller.particleCount.toFloat())
                put("bodies", matched.size.toFloat())
                if (matched.isNotEmpty()) {
                    put("meanDensity", matched.sumOf { it.d.toDouble() }.toFloat() / matched.size)
                }
            }
        } else emptyMap()

        val relationships: List<FieldRelationshipReading> = if (want.contains(FieldQueryInclude.RELATIONSHIPS)) {
            relationshipReadings()
        } else emptyList()

        // Influences: per-force attribution at the query point. The port has no impulse accumulator yet,
        // so this is empty-for-now (the field name mirrors JS `influences` so the shape stays identical).
        val influences: List<FieldInfluenceReading> = emptyList()

        return FieldQueryResult(
            query = query,
            frame = controller.env.frameN,
            time = controller.env.t,
            region = region,
            bodies = bodyReadings,
            metrics = metrics,
            relationships = relationships,
            influences = influences,
            // The projections registered on the field (metadata only) — JS `query().projections`.
            projections = projections.list(),
            lens = null,
        )
    }

    // ── substrate READ API: snapshot (JS critical-path 03) ─────────────────────────────
    /**
     * Capture the field's STATE at this frame — a portable, serializable [FieldSnapshot] (bodies, their
     * metrics + identity, the active formation, field-level metrics, relationships). This is *what the
     * field was doing*, the basis for `diff`/`replay` (later follow-ups); DISTINCT from the perf-metrics
     * snapshot. Mirror of the JS `@fundamental-engine/core` `snapshot()` — same field names + shape so a
     * capture is identical across planes.
     *
     * PRIVACY: each body's opaque `data` is WITHHELD by default — it is included only when [opts]
     * (`includeData` / a permissive `profile`) opts in AND the runtime [FieldPolicy] permits body data.
     * Relationships default in; `influences` / `projections` are present-but-empty in this port (no impulse
     * accumulator / projection registry yet — the field names mirror JS so the shape stays identical).
     *
     * `createdAt` is the FIELD clock (`env.t`), not wall time — deterministic. `id` is `snap-<frame>-<seq>`
     * with a per-field sequence. Read-only throughout: `snapshot()` never mutates field state.
     */
    fun snapshot(opts: FieldSnapshotOptions? = null): FieldSnapshot {
        val flags = resolveSnapshotFlags(opts ?: FieldSnapshotOptions())
        val includeData = flags.includeData && controller.policyPermitsBodyData()

        val bodies = controller.bodies
        val bodySnaps: List<FieldBodySnapshot> = bodies.map { b ->
            val identity = controller.bodyIdentity(b)
            val c = b.box.center
            FieldBodySnapshot(
                id = identity.id,
                identity = identity,
                // No body-authority lane in the port yet — fixed "anchored", the JS default.
                authority = "anchored",
                rect = FieldRect(c.x - b.box.hw, c.y - b.box.hh, b.box.hw * 2f, b.box.hh * 2f),
                position = Vec3(c.x, c.y, 0f),
                tokens = b.tokens.toList(),
                metrics = buildMap {
                    put("density", b.d)
                    put("count", b.count)
                    put("engaged", if (b.isEngaged) 1f else 0f)
                    if (b.capacity > 0f) put("load", (b.accreted / b.capacity).coerceIn(0f, 1f))
                },
                // The port has no measured field-dimension lane yet — empty, matching the JS field name.
                dimensions = emptyMap(),
                // Privacy gate: caller opted in AND policy permits. Withheld by default.
                data = if (includeData) controller.dataOf(b) else null,
            )
        }

        val relationships: List<FieldRelationshipReading> = if (flags.includeRelationships) {
            relationshipReadings()
        } else emptyList()

        val metrics: Map<String, Float> = buildMap {
            put("particles", controller.particleCount.toFloat())
            put("bodies", bodies.size.toFloat())
            if (bodies.isNotEmpty()) {
                put("meanDensity", bodies.sumOf { it.d.toDouble() }.toFloat() / bodies.size)
            }
        }

        return FieldSnapshot(
            id = "snap-${controller.env.frameN}-${snapSeq++}",
            createdAt = controller.env.t,
            frame = controller.env.frameN,
            version = FIELD_VERSION,
            formations = listOf(controller.formationName),
            bodies = bodySnaps,
            relationships = relationships,
            metrics = metrics,
            // influences: no impulse accumulator in the port yet — empty, matching the JS field name.
            influences = emptyList(),
            // The projections registered on the field at capture (metadata only) — JS `snapshot().projections`.
            projections = projections.list(),
        )
    }

    /** Per-field snapshot id sequence — feeds `snap-<frame>-<seq>`. */
    private var snapSeq = 0

    /**
     * Compare two [FieldSnapshot]s and report what changed, by lane (bodies / relationships / metrics /
     * formations) — the substrate READ-API `diff` primitive (JS `FieldHandle.diff`). PURE: it reads only
     * the two snapshot objects, never touches this field's live state, and mutates nothing (the handle is
     * merely the door — you can pass any two captures, from this field or another). Delegates to the
     * standalone [diffFieldSnapshots].
     */
    fun diff(a: FieldSnapshot, b: FieldSnapshot): FieldDiff = diffFieldSnapshots(a, b)

    /**
     * Explain HOW the field changed from snapshot [a] to snapshot [b] — an ordered, narrated sequence of
     * causes (formations → relationships → body measurements → metric moves → forces) — the substrate
     * READ-API `replay` primitive (JS `FieldHandle.replay`). PURE: like [diff], it reads only the two
     * snapshot objects, never touches this field's live state, and mutates nothing (pass any two captures).
     * [ReplayOptions.focus] scopes the replay to one body id. Delegates to the standalone
     * [replayFieldSnapshots], which composes [diffFieldSnapshots].
     */
    fun replay(a: FieldSnapshot, b: FieldSnapshot, opts: ReplayOptions = ReplayOptions()): CausalReplay =
        replayFieldSnapshots(a, b, opts)

    // ── agent permissions (JS #894) ────────────────────────────────────────────────────
    /**
     * A capability-scoped, READ-ONLY [AgentFieldView] over this field — the surface a Software Agent uses
     * to read the field safely. It exposes only scoped reads (no mutators); every reading is tightened to
     * the granted [capabilities], then [redactions] strip named paths, and nothing widens past what the
     * field's [FieldPolicy] permits. Mirrors JS `forAgent`.
     */
    fun forAgent(capabilities: Collection<AgentCapability>, redactions: Collection<String> = emptyList()): AgentFieldView =
        AgentFieldView(this, capabilities, redactions)

    // ── event bus ─────────────────────────────────────────────────────────────────────
    private val _listeners = mutableListOf<Triple<FieldEvent, String, (FieldEventPayload) -> Unit>>()

    /**
     * Subscribe to a field event. Returns a [Subscription]; call [Subscription.cancel] to
     * unsubscribe. The [FieldEvent.TICK] event fires after each simulation frame.
     * Mirrors JS `on(event, handler)`.
     */
    fun on(event: FieldEvent, handler: (FieldEventPayload) -> Unit): Subscription {
        val id = java.util.UUID.randomUUID().toString()
        _listeners.add(Triple(event, id, handler))
        return Subscription { _listeners.removeAll { it.second == id } }
    }

    private fun fireEvent(event: FieldEvent, payload: FieldEventPayload) {
        for ((e, _, h) in _listeners) if (e == event) h(payload)
    }

    // ── overlay registry ──────────────────────────────────────────────────────────────
    private val _overlayRegistry = mutableMapOf<String, OverlayRenderer>()

    /**
     * Register a named overlay renderer — called by the host frame loop after underlay draw.
     * Mirrors JS `registerOverlay(key, renderer)`.
     */
    fun registerOverlay(key: String, renderer: OverlayRenderer) { _overlayRegistry[key] = renderer }

    /** Remove a previously registered overlay renderer. */
    fun removeOverlay(key: String) { _overlayRegistry.remove(key) }

    /** The live overlay registry — read by the Compose/View host to call custom renderers each frame. */
    val overlayRegistry: Map<String, OverlayRenderer> get() = _overlayRegistry

    // ── agents ────────────────────────────────────────────────────────────────────────
    private val _agentEntries = mutableListOf<Pair<String, AgentSpec>>()

    /**
     * Register an autonomous agent consumer. Each tick the engine evaluates the net force at
     * the agent's [AgentSpec.position] and calls [AgentSpec.onInfluence]. Returns an [AgentHandle];
     * call [AgentHandle.remove] to deregister. Mirrors JS `addAgent`.
     */
    fun addAgent(spec: AgentSpec): AgentHandle {
        val id = java.util.UUID.randomUUID().toString()
        _agentEntries.add(id to spec)
        return AgentHandle(spec) { _agentEntries.removeAll { it.first == id } }
    }

    private fun tickAgents() {
        for ((_, spec) in _agentEntries) {
            val pos = spec.position()
            val force = controller.sample(pos.x, pos.y)
            spec.onInfluence?.invoke(force)
        }
    }

    // ── substrate Projection Registry (JS critical-path 05) ────────────────────────────
    /**
     * The field's PROJECTION REGISTRY (JS `FieldHandle.projections`) — register named [FieldProjection]s
     * that map field STATE into an output surface, and read their metadata back through `query()` /
     * `snapshot()`. GOVERNANCE: a projection reveals state; it MAY NOT mutate the field (no forces, no body
     * or metric writes) — enforced by the registry only ever calling `apply(reading, target)`, never the
     * field. Bound projections auto-apply once per write phase (after feedback) via the after-tick hook.
     *
     * Portable surfaces on this native plane: `agent-json` ([agentJsonProjection] / [agentJsonTarget]) and a
     * generic host `callback` ([callbackProjection] / [callbackTarget]). The web surfaces (css / dom / svg)
     * are web-first and live in `@fundamental-engine/dom`. Mirrors the JS `ProjectionRegistry` shape.
     */
    val projections: ProjectionRegistry = ProjectionRegistry()

    // ── lifecycle ────────────────────────────────────────────────────────────────────
    init {
        // Wire the after-tick hook so TICK events + agent updates fire each frame, and bound projections
        // auto-apply on the write phase (after feedback easing — read-only; never moves matter, mirroring
        // the JS `applyBoundProjections()` call site).
        controller.onAfterTick = {
            projections.applyBoundProjections()
            tickAgents()
            fireEvent(FieldEvent.TICK, FieldEventPayload(FieldEvent.TICK))
        }
    }

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
    /**
     * FIRST-CLASS IDENTITY resolver (JS #884): derive a stable [FieldBodyIdentity] for a scanned body.
     * Null ⇒ default derivation (a monotonic `body-N`). See [FieldController.identify].
     */
    identify: ((Body) -> FieldBodyIdentity?)? = null,
    /** Initial runtime [FieldPolicy] (JS #892) — what this host/session/user/app permits. Additive. */
    policy: FieldPolicy = FieldPolicy.UNBOUNDED,
): FieldHandle = FieldHandle(
    FieldController(width, height, depth, particleCount, seed).also {
        it.identify = identify
        it.setPolicy(policy)
    },
)
