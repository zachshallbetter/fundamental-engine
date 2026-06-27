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
 * Everything the engine needs from the surrounding runtime. Implement once per platform target.
 * Equivalent to `browserHost()` in @fundamental-engine/dom.
 */
interface FieldHost {
    // ── geometry ──────────────────────────────────────────────────────────
    val volume: FieldVolume
    /** Current scroll offset in y (units); 0 when not applicable. */
    val scrollY: Float
    /** Total scrollable height; 0 when not applicable. */
    val scrollHeight: Float

    // ── system signals ────────────────────────────────────────────────────
    val prefersReducedMotion: Boolean
    val isHidden: Boolean

    // ── loop ──────────────────────────────────────────────────────────────
    /** Schedule a display-sync callback; returns a cancellation token. */
    fun scheduleFrame(callback: (Double) -> Unit): Any
    fun cancelFrame(token: Any)

    // ── events (each returns an unsubscribe closure) ────────────────────────
    fun onResize(callback: () -> Unit): () -> Unit
    fun onScroll(callback: () -> Unit): () -> Unit
    fun onVisibility(callback: () -> Unit): () -> Unit
    fun onInput(callback: () -> Unit): () -> Unit

    // ── projection ──────────────────────────────────────────────────────────
    val projection: FieldProjection

    // ── body scanning ───────────────────────────────────────────────────────
    /** Walk the view hierarchy and return bodies found (the `[data-body]` scanner equivalent). */
    fun scanBodies(): List<Body>
    /** Geometry of a view in world space, or null if unavailable. */
    fun worldBox(view: Any): Box?
}
