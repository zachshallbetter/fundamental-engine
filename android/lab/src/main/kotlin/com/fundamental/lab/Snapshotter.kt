package com.fundamental.lab

import java.awt.image.BufferedImage
import kotlin.math.abs

// Visual-snapshot signature (§654) — the Kotlin analog of the Swift FieldLab's `Snapshotter.signature`.
// Reduces a rendered frame to a coarse PERCEPTUAL signature: a downsampled luminance grid + the lit
// fraction + the luminance centroid. A pixel-exact golden flakes (rasterization differs across
// machines; wander is seeded but float drift exists), so the gate asserts STRUCTURE: matter draws
// coherent, bounded content in the right place, and the signature is stable run-to-run.

/** A coarse perceptual fingerprint of a rendered frame. */
class Signature(
    val cells: Int,
    val grid: FloatArray, // cells×cells mean luminance ∈ [0,1], row-major
    val lit: Float, // fraction of pixels above the lit threshold ∈ [0,1]
    val cx: Float, // luminance centroid x ∈ [0,1]
    val cy: Float, // luminance centroid y ∈ [0,1]
) {
    /** A scalar distance to another signature — 0 = identical. Combines grid + lit + centroid. */
    fun distance(o: Signature): Float {
        require(o.cells == cells) { "signatures must share a cell count" }
        var g = 0f
        for (i in grid.indices) g += abs(grid[i] - o.grid[i])
        g /= grid.size
        return g + abs(lit - o.lit) + abs(cx - o.cx) + abs(cy - o.cy)
    }
}

object Snapshotter {
    private const val LIT_THRESHOLD = 0.06f // luminance above which a pixel counts as "matter"

    fun signature(img: BufferedImage, cells: Int = 8): Signature {
        val w = img.width
        val h = img.height
        val grid = FloatArray(cells * cells)
        val counts = IntArray(cells * cells)
        var litPixels = 0L
        var sx = 0.0
        var sy = 0.0
        for (y in 0 until h) {
            val cellY = (y * cells / h).coerceIn(0, cells - 1)
            for (x in 0 until w) {
                val rgb = img.getRGB(x, y)
                val r = (rgb ushr 16 and 0xFF)
                val gC = (rgb ushr 8 and 0xFF)
                val b = (rgb and 0xFF)
                val lum = (0.2126f * r + 0.7152f * gC + 0.0722f * b) / 255f
                val cellX = (x * cells / w).coerceIn(0, cells - 1)
                val idx = cellY * cells + cellX
                grid[idx] += lum
                counts[idx]++
                if (lum > LIT_THRESHOLD) { litPixels++; sx += x; sy += y }
            }
        }
        for (i in grid.indices) if (counts[i] > 0) grid[i] /= counts[i]
        val total = (w.toLong() * h).coerceAtLeast(1)
        val lit = litPixels.toFloat() / total
        val cx = if (litPixels > 0) (sx / litPixels / w).toFloat() else 0.5f
        val cy = if (litPixels > 0) (sy / litPixels / h).toFloat() else 0.5f
        return Signature(cells, grid, lit, cx, cy)
    }
}
