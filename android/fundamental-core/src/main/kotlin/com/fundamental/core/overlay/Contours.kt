package com.fundamental.core.overlay

import com.fundamental.core.engine.Particle

// Iso-contour readings (temperature / energy) — a coarse scalar grid splatted from the particle pool,
// then marching squares at a few thresholds. Pure; returns [Segment]s a host draws. This is the
// computation the Swift FieldLab's CoreGraphics renderer does host-side, lifted to portable Kotlin.

/** A coarse scalar field over the viewport. */
class ScalarGrid2D(val cols: Int, val rows: Int, val cell: Float, val data: FloatArray) {
    fun at(c: Int, r: Int): Float = data[r * cols + c]
    fun max(): Float { var m = 0f; for (v in data) if (v > m) m = v; return m }
}

/** Splat a per-particle scalar (heat, energy, …) into a coarse nearest-cell grid. */
fun scalarFromParticles(particles: List<Particle>, w: Float, h: Float, cell: Float = 40f, value: (Particle) -> Float): ScalarGrid2D {
    val cols = (w / cell).toInt() + 1
    val rows = (h / cell).toInt() + 1
    val data = FloatArray(cols * rows)
    for (p in particles) {
        val c = (p.position.x / cell).toInt().coerceIn(0, cols - 1)
        val r = (p.position.y / cell).toInt().coerceIn(0, rows - 1)
        data[r * cols + c] += value(p)
    }
    return ScalarGrid2D(cols, rows, cell, data)
}

private fun frac(a: Float, b: Float, t: Float): Float =
    if (b == a) 0.5f else ((t - a) / (b - a)).coerceIn(0f, 1f)

/**
 * Marching squares over [g] at each threshold → contour segments. Standard 16-case table with linear
 * edge interpolation; ambiguous saddles (5, 10) emit both diagonals.
 */
fun isoContours(g: ScalarGrid2D, thresholds: List<Float>): List<Segment> {
    val segs = ArrayList<Segment>()
    val cell = g.cell
    for (t in thresholds) {
        for (r in 0 until g.rows - 1) {
            for (c in 0 until g.cols - 1) {
                val tl = g.at(c, r); val tr = g.at(c + 1, r); val br = g.at(c + 1, r + 1); val bl = g.at(c, r + 1)
                var idx = 0
                if (tl >= t) idx = idx or 8
                if (tr >= t) idx = idx or 4
                if (br >= t) idx = idx or 2
                if (bl >= t) idx = idx or 1
                if (idx == 0 || idx == 15) continue
                val x0 = c * cell; val y0 = r * cell; val x1 = x0 + cell; val y1 = y0 + cell
                // edge crossing points (top, right, bottom, left)
                val topX = x0 + cell * frac(tl, tr, t); val topY = y0
                val rightX = x1; val rightY = y0 + cell * frac(tr, br, t)
                val botX = x0 + cell * frac(bl, br, t); val botY = y1
                val leftX = x0; val leftY = y0 + cell * frac(tl, bl, t)
                fun seg(ax: Float, ay: Float, bx: Float, by: Float) = segs.add(Segment(ax, ay, bx, by))
                when (idx) {
                    1, 14 -> seg(leftX, leftY, botX, botY)
                    2, 13 -> seg(botX, botY, rightX, rightY)
                    3, 12 -> seg(leftX, leftY, rightX, rightY)
                    4, 11 -> seg(topX, topY, rightX, rightY)
                    6, 9 -> seg(topX, topY, botX, botY)
                    7, 8 -> seg(topX, topY, leftX, leftY)
                    5 -> { seg(topX, topY, leftX, leftY); seg(botX, botY, rightX, rightY) }
                    10 -> { seg(topX, topY, rightX, rightY); seg(leftX, leftY, botX, botY) }
                }
            }
        }
    }
    return segs
}

/** Convenience: temperature iso-contours from the pool (the matter's carried heat). */
fun temperatureContours(particles: List<Particle>, w: Float, h: Float): List<Segment> {
    val g = scalarFromParticles(particles, w, h) { it.heat }
    val m = g.max(); if (m <= 0f) return emptyList()
    return isoContours(g, listOf(0.25f, 0.5f, 0.75f).map { it * m })
}

/** Convenience: kinetic-energy iso-contours (½·m·|v|²) from the pool. */
fun energyContours(particles: List<Particle>, w: Float, h: Float): List<Segment> {
    val g = scalarFromParticles(particles, w, h) { 0.5f * it.mass * it.velocity.lengthSquared() }
    val m = g.max(); if (m <= 0f) return emptyList()
    return isoContours(g, listOf(0.25f, 0.5f, 0.75f).map { it * m })
}
