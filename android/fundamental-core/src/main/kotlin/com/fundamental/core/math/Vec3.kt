package com.fundamental.core.math

import kotlin.math.sqrt

/**
 * The 3D vector the whole engine speaks in — the Kotlin counterpart of Swift's `SIMD3<Float>`
 * (see `swift/Sources/FundamentalCore/Math/`). Float (f32) on purpose: it mirrors the Swift port's
 * precision so the cross-plane conformance golden holds across all three planes (JS f64 → Swift f32
 * → Kotlin f32, within tolerance).
 *
 * The JS engine is 2D because the DOM is; this port is 3D-native, and at z = 0 every formula
 * reduces to the JS math exactly.
 */
data class Vec3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(o: Vec3): Vec3 = Vec3(x + o.x, y + o.y, z + o.z)
    operator fun minus(o: Vec3): Vec3 = Vec3(x - o.x, y - o.y, z - o.z)
    operator fun times(s: Float): Vec3 = Vec3(x * s, y * s, z * s)
    operator fun div(s: Float): Vec3 = Vec3(x / s, y / s, z / s)

    /** |v| — the magnitude (Swift `simd_length`). */
    fun length(): Float = sqrt(x * x + y * y + z * z)

    /** |v|² — avoids the sqrt when only comparing distances (Swift `simd_length_squared`). */
    fun lengthSquared(): Float = x * x + y * y + z * z

    /** v · o (Swift `simd_dot`). */
    fun dot(o: Vec3): Float = x * o.x + y * o.y + z * o.z

    /** this × o — order matters; mirrors `simd_cross(this, o)`. */
    fun cross(o: Vec3): Vec3 = Vec3(
        y * o.z - z * o.y,
        z * o.x - x * o.z,
        x * o.y - y * o.x,
    )

    /**
     * Rotate this vector about the plane axis (z) by [angle] radians — the z=0 reduction of
     * `simd_quatf(angle:, axis: (0,0,1)).act(v)`. Used by magnetism, lens, warp, jet, spawn.
     */
    fun rotatedAboutZ(angle: Float): Vec3 {
        val c = kotlin.math.cos(angle)
        val s = kotlin.math.sin(angle)
        return Vec3(x * c - y * s, x * s + y * c, z)
    }

    companion object {
        val ZERO = Vec3(0f, 0f, 0f)
    }
}
