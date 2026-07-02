package com.fundamental.platform

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.math.Vec3
import java.util.IdentityHashMap
import kotlin.math.max
import kotlin.math.min

// MARK: - FieldMeasurement

/**
 * An immutable geometry snapshot for one body — the 3D counterpart of JS's `FieldMeasurement`.
 */
data class FieldMeasurement(
    val body: Body,
    val box: Box,
    /** Fraction of the body's volume visible within the host volume ∈ [0,1]. */
    val visibilityRatio: Float,
    val timestamp: Double,
) {
    val isVisible: Boolean get() = visibilityRatio > 0
}

// MARK: - MeasurementRegistry

/**
 * Frame-stable geometry. Reads every registered body's world box once per frame and
 * hands back an immutable snapshot, so the rest of the system works from one consistent
 * set of boxes instead of each force measuring whenever it likes (layout thrash).
 *
 * Strict read-phase: `measure()` only reads. Feedback (writes) happens separately.
 *
 * Cadence (JS #508, native audit #509): `measure()` runs in the read phase of EVERY frame —
 * there is no equivalent of the JS core's every-6th-frame measure throttle, so body centres
 * track a scroll/pan with zero between-measure staleness and need no scroll-delta compensation.
 * If a measure cadence is ever introduced here, port the JS `dScroll` compensation (field.ts)
 * with its contained guard alongside it.
 */
class MeasurementRegistry {
    // Swift keyed entries by `ObjectIdentifier(body)` (object identity). Kotlin mirror:
    // an IdentityHashMap keyed on the Body reference itself (Any key by identity).
    private val entries: IdentityHashMap<Body, Body> = IdentityHashMap()
    var snapshot: List<FieldMeasurement> = emptyList()
        private set
    private var guard_: ((String) -> Unit)? = null

    // MARK: Phase guard

    /** Install a phase guard (FrameScheduler supplies one via `readGuard()`). */
    fun setPhaseGuard(guard_: ((String) -> Unit)?) {
        this.guard_ = guard_
    }

    // MARK: Registration

    fun register(body: Body) {
        entries[body] = body
    }

    fun unregister(body: Body) {
        entries.remove(body)
    }

    fun has(body: Body): Boolean {
        return entries[body] != null
    }

    val count: Int get() = entries.size

    // MARK: Measurement

    /** Read every registered body's geometry once. Call only from the `read` phase. */
    fun measure(
        now: Double = 0.0,
        volume: FieldVolume,
        host: FieldHost,
    ): List<FieldMeasurement> {
        guard_?.invoke("measure")

        val out = ArrayList<FieldMeasurement>()
        val toRemove = ArrayList<Body>()

        for ((id, body) in entries) {
            // TODO(parity): Swift's `Body` exposes `weak var view: AnyObject?` and this loop reads
            // `body.view`, dropping the body when the view is gone. The Kotlin core `Body` (Types.kt)
            // was trimmed and has no `view` field yet, so we pass the `Body` itself as the view handle
            // to `host.worldBox`. Restore the `body.view`-based read once `Body.view` lands in core.
            val view: Any = body
            val box = host.worldBox(view)
            if (box == null) {
                toRemove.add(id)
                continue
            }
            body.box = box
            val ratio = visibilityRatio(box = box, volume = volume)
            out.add(FieldMeasurement(body = body, box = box, visibilityRatio = ratio, timestamp = now))
        }

        for (id in toRemove) entries.remove(id)
        snapshot = out
        return out
    }

    fun measurement(body: Body): FieldMeasurement? {
        return snapshot.firstOrNull { it.body === body }
    }
}

// MARK: - Visibility

/** Overlap fraction of a box within the host volume ∈ [0,1]. */
private fun visibilityRatio(box: Box, volume: FieldVolume): Float {
    // Volume of box
    val bMin = box.center - box.halfExtents
    val bMax = box.center + box.halfExtents
    val vMax = Vec3(volume.width, volume.height, max(volume.depth, 1f))

    val ox = max(0f, min(bMax.x, vMax.x) - max(bMin.x, 0f))
    val oy = max(0f, min(bMax.y, vMax.y) - max(bMin.y, 0f))
    val oz = max(0f, min(bMax.z, vMax.z) - max(bMin.z, 0f))

    val boxVol = (bMax.x - bMin.x) * (bMax.y - bMin.y) * max(bMax.z - bMin.z, 1f)
    val overlap = ox * oy * oz

    if (boxVol <= 0) return 0f
    return min(1f, overlap / boxVol)
}
