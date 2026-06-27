package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.floor

/**
 * A uniform-grid spatial hash for neighbour queries — the index that makes
 * particle↔particle forces (§20.1 class [B]) O(n·k) instead of O(n²).
 *
 * 3D-native: bins are cubes. On 2D platforms every particle sits in the z=0
 * cell layer and the structure degenerates to the JS 2D grid with no overhead
 * beyond one extra loop iteration.
 *
 * Rebuilt each frame from the live particle pool; query with `near(p, r)`.
 */
class SpatialHash(cellSize: Float = 64f) {
    private val cell: Float = if (cellSize > 0f) cellSize else 64f
    private val bins: HashMap<Long, MutableList<Particle>> = HashMap()

    // pack three signed cell coords (21 bits each, offset to non-negative).
    private fun key(cx: Long, cy: Long, cz: Long): Long =
        ((cx + 0xF_FFFFL) shl 42) or ((cy + 0xF_FFFFL) shl 21) or (cz + 0xF_FFFFL)

    fun clear() {
        bins.clear()
    }

    fun insert(item: Particle) {
        val p = item.position
        val k = key(
            floor(p.x / cell).toLong(),
            floor(p.y / cell).toLong(),
            floor(p.z / cell).toLong(),
        )
        bins.getOrPut(k) { mutableListOf() }.add(item)
    }

    fun rebuild(items: List<Particle>) {
        clear()
        for (it in items) insert(it)
    }

    /** Items within radius `r` of `p`, filtered by true distance. */
    fun near(p: Vec3, r: Float): List<Particle> {
        val out = mutableListOf<Particle>()
        val r2 = r * r
        val minCx = floor((p.x - r) / cell).toLong()
        val minCy = floor((p.y - r) / cell).toLong()
        val minCz = floor((p.z - r) / cell).toLong()
        val maxCx = floor((p.x + r) / cell).toLong()
        val maxCy = floor((p.y + r) / cell).toLong()
        val maxCz = floor((p.z + r) / cell).toLong()
        var cx = minCx
        while (cx <= maxCx) {
            var cy = minCy
            while (cy <= maxCy) {
                var cz = minCz
                while (cz <= maxCz) {
                    val bin = bins[key(cx, cy, cz)]
                    if (bin != null) {
                        for (it in bin) {
                            if ((it.position - p).lengthSquared() <= r2) {
                                out.add(it)
                            }
                        }
                    }
                    cz += 1
                }
                cy += 1
            }
            cx += 1
        }
        return out
    }
}
