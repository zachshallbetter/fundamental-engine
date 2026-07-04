package com.fundamental.core.overlay

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.FieldLineOpts
import com.fundamental.core.engine.ForceRegistry
import com.fundamental.core.engine.forceAt
import com.fundamental.core.math.netField
import com.fundamental.core.engine.traceFieldLines
import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
import kotlin.math.min

/** A line segment in field space — the universal overlay-reading primitive a host draws. */
data class Segment(val ax: Float, val ay: Float, val bx: Float, val by: Float)

/**
 * Overlay readings (§Field Surfaces) — line diagnostics computed over the field, returned as plain
 * [Segment]s so any host (the desktop lab, a Compose Canvas) can draw them. Each reveals one quantity
 * the field is computing anyway; readings measure, they never push.
 */
object Overlays {

    /**
     * The net push a still probe feels on a grid, as arrows. `normalized` → unit streamline directions
     * (the `streamlines` reading); otherwise scaled by magnitude (the `forceVectors` reading).
     */
    fun vectorField(
        bodies: List<Body>, forces: ForceRegistry, w: Float, h: Float,
        spacing: Float = 48f, normalized: Boolean = true, scale: Float = 16f,
    ): List<Segment> {
        val segs = ArrayList<Segment>()
        var y = spacing / 2
        while (y < h) {
            var x = spacing / 2
            while (x < w) {
                val f = forceAt(bodies, forces, Vec3(x, y, 0f))
                val m = f.length()
                if (m > 1e-6f) {
                    val ux = f.x / m; val uy = f.y / m
                    val len = if (normalized) scale else min(scale * 3f, m * scale)
                    val ex = x + ux * len; val ey = y + uy * len
                    segs.add(Segment(x, y, ex, ey))
                    // arrowhead — two short barbs
                    val ah = len * 0.32f
                    val px = -uy; val py = ux
                    segs.add(Segment(ex, ey, ex - ux * ah + px * ah * 0.5f, ey - uy * ah + py * ah * 0.5f))
                    segs.add(Segment(ex, ey, ex - ux * ah - px * ah * 0.5f, ey - uy * ah - py * ah * 0.5f))
                }
                x += spacing
            }
            y += spacing
        }
        return segs
    }

    /**
     * The structure field's flow lines (the `fieldLines` reading) — traces of `netField`, the dipoles
     * and monopoles bodies radiate. Empty for forces with no `field()` (e.g. plain attract); populated
     * for gravity / charge / magnetism.
     */
    fun fieldLines(
        bodies: List<Body>, forces: ForceRegistry, w: Float, h: Float, seedSpacing: Float = 110f,
    ): List<Segment> {
        val sampler: (Vec3) -> Vec3 = { p -> netField(bodies, forces, p) }
        val seeds = ArrayList<Vec3>()
        var y = seedSpacing / 2
        while (y < h) { var x = seedSpacing / 2; while (x < w) { seeds.add(Vec3(x, y, 0f)); x += seedSpacing }; y += seedSpacing }
        val opts = FieldLineOpts(bounds = w to h, maxTurns = 1.5f, maxSteps = 220)
        val segs = ArrayList<Segment>()
        for (line in traceFieldLines(sampler, seeds, opts)) {
            for (i in 0 until line.size - 1) segs.add(Segment(line[i].x, line[i].y, line[i + 1].x, line[i + 1].y))
        }
        return segs
    }

    /** A reference lattice displaced by the local field (the `grid` deformation reading). */
    fun deformationGrid(
        bodies: List<Body>, forces: ForceRegistry, w: Float, h: Float, spacing: Float = 46f, gain: Float = 9f,
    ): List<Segment> {
        val cols = (w / spacing).toInt()
        val rows = (h / spacing).toInt()
        val cap = spacing * 0.42f
        val disp = Array(rows + 1) { r ->
            Array(cols + 1) { c ->
                val x = c * spacing; val y = r * spacing
                val f = forceAt(bodies, forces, Vec3(x, y, 0f))
                Vec3(x + clamp(f.x * gain, -cap, cap), y + clamp(f.y * gain, -cap, cap), 0f)
            }
        }
        val segs = ArrayList<Segment>()
        for (r in 0..rows) for (c in 0..cols) {
            val p = disp[r][c]
            if (c < cols) { val q = disp[r][c + 1]; segs.add(Segment(p.x, p.y, q.x, q.y)) }
            if (r < rows) { val q = disp[r + 1][c]; segs.add(Segment(p.x, p.y, q.x, q.y)) }
        }
        return segs
    }
}
