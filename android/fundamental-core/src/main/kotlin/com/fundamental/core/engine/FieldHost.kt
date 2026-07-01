package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.max

/**
 * The platform seam + projection — ported from FieldHost.swift line-for-line.
 *
 * Lives in core (Android-free) because the contract has zero host deps; a platform target
 * (Compose, a `View`/`Canvas` host) implements [FieldHost], and `:fundamental-platform`
 * drives it. `depth = 0` is the flat field (every formula reduces to the JS 2D math exactly).
 */

/** The render surface's current dimensions. `scale` is the DPR equivalent. */
data class FieldVolume(
    val width: Float,
    val height: Float,
    val depth: Float = 0f,
    val scale: Float = 1f,
) {
    val size3: Vec3 get() = Vec3(width, height, depth)
}

/** Maps a 3D world position to a 2D render point (+ a depth hint for size/opacity effects). */
interface FieldProjection {
    /** Project [p] to a 2D point in the render surface's coordinate space. */
    fun project(p: Vec3): Pair<Float, Float>
    /** Depth hint ∈ [0,1] for size/opacity effects. 0 = at surface; 1 = far back. */
    fun depthHint(p: Vec3): Float
}

/** Flat projection — z is ignored. The depth-0 (flat field) default. */
class FlatProjection : FieldProjection {
    override fun project(p: Vec3): Pair<Float, Float> = p.x to p.y
    override fun depthHint(p: Vec3): Float = 0f
}

/** Shallow perspective — z gives a size/opacity nudge without leaving 2D. */
class PerspectiveProjection(
    val focalLength: Float = 500f,
    val strength: Float = 0.1f,
) : FieldProjection {
    override fun project(p: Vec3): Pair<Float, Float> {
        val scale = focalLength / max(focalLength - p.z * strength, 1f)
        return (p.x * scale) to (p.y * scale)
    }
    override fun depthHint(p: Vec3): Float = (-p.z / focalLength).coerceIn(0f, 1f)
}

/**
 * The SMALLEST surface a host must supply for the engine to run (JS #888 `MinimalFieldHost`). It is the
 * required core of [FieldHost]; everything else (scroll, reduced-motion, visibility, and every event
 * subscription) is an OPTIONAL capability the engine degrades around when absent (see [hostCapabilities]).
 * A host that supplies only these members runs the full simulation + feedback headlessly — it just never
 * scrolls, never pauses on visibility, and reports motion allowed.
 *
 * The two things a host MUST provide:
 * - **geometry** — [volume] (+ [projection]) and the body scan ([scanBodies] / [worldBox]): *where* the
 *   field lives and in what coordinate space.
 * - **time** — [scheduleFrame] / [cancelFrame]: how the frame loop is scheduled.
 */
interface MinimalFieldHost {
    // ── geometry ──────────────────────────────────────────────────────────
    val volume: FieldVolume
    val projection: FieldProjection

    // ── body scanning ───────────────────────────────────────────────────────
    /** Walk the view hierarchy and return bodies found (the `[data-body]` scanner equivalent). */
    fun scanBodies(): List<Body>
    /** Geometry of a view in world space, or null if unavailable. */
    fun worldBox(view: Any): Box?

    // ── time / loop ─────────────────────────────────────────────────────────
    /** Schedule a display-sync callback; returns a cancellation token. */
    fun scheduleFrame(callback: (Double) -> Unit): Any
    fun cancelFrame(token: Any)
}

/**
 * The full renderer/environment SPI — the [MinimalFieldHost] required core plus the OPTIONAL capabilities
 * the engine consumes when a host offers them (JS #888). Absent capabilities degrade gracefully (scroll →
 * 0, reduced-motion / hidden → false, subscriptions → no-op). Existing hosts that implement every member
 * keep satisfying this contract unchanged; a new host only has to supply the required core and lets the
 * defaults below fill the rest. Use [hostCapabilities] to detect what a given host offers.
 */
interface FieldHost : MinimalFieldHost {
    /** Current scroll offset in y (units); 0 when not applicable. */
    val scrollY: Float get() = 0f
    /** Total scrollable height; 0 when not applicable. */
    val scrollHeight: Float get() = 0f

    // ── system signals ────────────────────────────────────────────────────
    val prefersReducedMotion: Boolean get() = false
    val isHidden: Boolean get() = false

    // ── events (each returns an unsubscribe closure) ────────────────────────
    fun onResize(callback: () -> Unit): () -> Unit = NEVER_UNSUBSCRIBE
    fun onScroll(callback: () -> Unit): () -> Unit = NEVER_UNSUBSCRIBE
    fun onVisibility(callback: () -> Unit): () -> Unit = NEVER_UNSUBSCRIBE
    fun onInput(callback: () -> Unit): () -> Unit = NEVER_UNSUBSCRIBE
}

private val NEVER_UNSUBSCRIBE: () -> Unit = {}

/**
 * What optional capabilities a [FieldHost] actually supplies — the "host conformance" read-out (JS #888).
 * The third parity/testing category alongside API-surface parity and mathematical conformance: *does this
 * host tick time, provide geometry, feed back, project…?* A capability reads true when the host overrides
 * the corresponding default; the engine degrades gracefully around any that stay at their defaults.
 */
data class HostCapabilities(
    /** always true — the required core (geometry + time) is present by type. */
    val geometry: Boolean = true,
    /** the host schedules frames — always true for a valid host. */
    val time: Boolean = true,
    /** the host reports a non-zero scroll position or scrollable height. */
    val scroll: Boolean,
    /** the host reports the reduced-motion preference. */
    val reducedMotion: Boolean,
    /** the host reports surface visibility so the loop can auto-pause. */
    val visibility: Boolean,
)

/**
 * Inspect which optional capabilities a host supplies — see [HostCapabilities] (JS #888). Since Kotlin
 * default interface methods are indistinguishable from overrides by reflection, capability detection is
 * value-based: a host reports a capability when it produces a non-default signal (a non-zero scroll,
 * reduced-motion on, or hidden on). Pure and allocation-light; safe on a [MinimalFieldHost] (every
 * optional lane reads its default → false).
 */
fun hostCapabilities(host: FieldHost): HostCapabilities = HostCapabilities(
    scroll = host.scrollY != 0f || host.scrollHeight != 0f,
    reducedMotion = host.prefersReducedMotion,
    visibility = host.isHidden,
)

/**
 * Build a full [FieldHost] from a [MinimalFieldHost] plus optional overrides — the no-op / graceful
 * defaults fill the rest (JS #888 `defineHost`). The sanctioned way to author a host without the whole
 * subscription boilerplate: supply the required core (and whatever else your environment offers) and the
 * field runs. Pure; touches no globals.
 */
fun defineHost(
    minimal: MinimalFieldHost,
    scrollY: () -> Float = { 0f },
    scrollHeight: () -> Float = { 0f },
    prefersReducedMotion: () -> Boolean = { false },
    isHidden: () -> Boolean = { false },
    onResize: (() -> Unit) -> (() -> Unit) = { NEVER_UNSUBSCRIBE },
    onScroll: (() -> Unit) -> (() -> Unit) = { NEVER_UNSUBSCRIBE },
    onVisibility: (() -> Unit) -> (() -> Unit) = { NEVER_UNSUBSCRIBE },
    onInput: (() -> Unit) -> (() -> Unit) = { NEVER_UNSUBSCRIBE },
): FieldHost = object : FieldHost {
    override val volume: FieldVolume get() = minimal.volume
    override val projection: FieldProjection get() = minimal.projection
    override fun scanBodies(): List<Body> = minimal.scanBodies()
    override fun worldBox(view: Any): Box? = minimal.worldBox(view)
    override fun scheduleFrame(callback: (Double) -> Unit): Any = minimal.scheduleFrame(callback)
    override fun cancelFrame(token: Any) = minimal.cancelFrame(token)
    override val scrollY: Float get() = scrollY()
    override val scrollHeight: Float get() = scrollHeight()
    override val prefersReducedMotion: Boolean get() = prefersReducedMotion()
    override val isHidden: Boolean get() = isHidden()
    override fun onResize(callback: () -> Unit): () -> Unit = onResize(callback)
    override fun onScroll(callback: () -> Unit): () -> Unit = onScroll(callback)
    override fun onVisibility(callback: () -> Unit): () -> Unit = onVisibility(callback)
    override fun onInput(callback: () -> Unit): () -> Unit = onInput(callback)
}
