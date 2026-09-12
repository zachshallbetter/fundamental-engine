package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.sqrt

// Render-mode geometry — the Kotlin port of swift/Sources/FundamentalCore/Engine/RenderModes.swift
// (itself the port of packages/core/src/engine/render-modes.ts, §20.6).
//
// The pure geometry behind the links / metaballs / voronoi render modes, extracted from any drawing
// surface so it can be unit-tested headlessly and shared by every Kotlin host (the Compose `FieldView`
// canvas, the JVM lab's Java2D renderer). A host owns pixels and colour; this file owns the shapes.

/** Opacity of a particle↔particle link by separation (§20.6 links mode). */
fun linkAlpha(d: Float, r: Float, maxAlpha: Float = 0.12f): Float {
    if (d >= r) return 0f
    return (1f - d / r) * maxAlpha
}

// ── Metaballs — marching squares over a particle density field ──────────────────────────────────

/** A line segment in cell-local coordinates ([0,1]², origin top-left, +y down). */
data class IsoSeg(val x1: Float, val y1: Float, val x2: Float, val y2: Float)

/**
 * The fractional crossing of the iso level between two corner values a → b.
 * Linear interpolation t = (iso − a)/(b − a), clamped to [0,1]; 0.5 if flat.
 */
fun isoCross(a: Float, b: Float, iso: Float): Float {
    if (a == b) return 0.5f
    return ((iso - a) / (b - a)).coerceIn(0f, 1f)
}

/**
 * Marching-squares contour for one cell (§20.6 metaballs). Given the densities at the four corners —
 * [tl], [tr], [br], [bl] (clockwise from top-left) — and the iso [level], return the 0–2 segments where
 * the contour crosses the cell's edges, in cell-local [0,1]². The two ambiguous saddle cases (5, 10)
 * are resolved the conventional way.
 */
fun marchingCell(tl: Float, tr: Float, br: Float, bl: Float, level: Float): List<IsoSeg> {
    // edge crossing points (only the ones a case uses are read)
    val tx = isoCross(tl, tr, level) // top edge tl→tr
    val ry = isoCross(tr, br, level) // right edge tr→br
    val bx = isoCross(bl, br, level) // bottom edge bl→br
    val ly = isoCross(tl, bl, level) // left edge tl→bl
    fun t() = Pair(tx, 0f)
    fun r() = Pair(1f, ry)
    fun b() = Pair(bx, 1f)
    fun l() = Pair(0f, ly)
    fun seg(a: Pair<Float, Float>, c: Pair<Float, Float>) = IsoSeg(a.first, a.second, c.first, c.second)
    // case index: one bit per corner above the level (tl=8, tr=4, br=2, bl=1)
    val c = (if (tl > level) 8 else 0) or (if (tr > level) 4 else 0) or
        (if (br > level) 2 else 0) or (if (bl > level) 1 else 0)
    return when (c) {
        0, 15 -> emptyList()
        1, 14 -> listOf(seg(l(), b()))
        2, 13 -> listOf(seg(b(), r()))
        3, 12 -> listOf(seg(l(), r()))
        4, 11 -> listOf(seg(t(), r()))
        6, 9 -> listOf(seg(t(), b()))
        7, 8 -> listOf(seg(l(), t()))
        5 -> listOf(seg(l(), t()), seg(b(), r())) // tr & bl above — saddle
        10 -> listOf(seg(l(), b()), seg(t(), r())) // tl & br above — saddle
        else -> emptyList()
    }
}

/**
 * Splat one particle's smooth density kernel onto a scalar grid (additive). [grid] is a row-major
 * [cols] × [rows] array of node densities at world (gx·[step], gy·[step]); each particle contributes
 * (1 − d/[radius])² to every node within [radius]. Pure — no rendering.
 */
fun splatDensity(
    grid: FloatArray,
    cols: Int,
    rows: Int,
    step: Float,
    px: Float,
    py: Float,
    radius: Float,
    weight: Float = 1f,
) {
    if (radius <= 0f) return
    val gx0 = maxOf(0, floor((px - radius) / step).toInt())
    val gx1 = minOf(cols - 1, ceil((px + radius) / step).toInt())
    val gy0 = maxOf(0, floor((py - radius) / step).toInt())
    val gy1 = minOf(rows - 1, ceil((py + radius) / step).toInt())
    if (gx0 > gx1 || gy0 > gy1) return
    val r2 = radius * radius
    for (gy in gy0..gy1) {
        for (gx in gx0..gx1) {
            val dx = gx * step - px
            val dy = gy * step - py
            val d2 = dx * dx + dy * dy
            if (d2 >= r2) continue
            val f = 1f - sqrt(d2) / radius
            grid[gy * cols + gx] += weight * f * f
        }
    }
}

// ── Voronoi — nearest-site cells over the particle field ────────────────────────────────────────

/** Index of the nearest site to a point, or -1 if [sites] is empty. */
fun nearestSite(x: Float, y: Float, sites: List<Vec3>): Int {
    var best = -1
    var bestD2 = Float.POSITIVE_INFINITY
    for (i in sites.indices) {
        val s = sites[i]
        val dx = s.x - x
        val dy = s.y - y
        val d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
            bestD2 = d2
            best = i
        }
    }
    return best
}

/**
 * Index of the nearest particle to a point within [candidates], or -1 if empty — the [nearestSite]
 * variant a host uses when its sites ARE the pool. Takes the candidate list a spatial-hash query
 * returns, so a voronoi grid sweep never materializes a positions list per node.
 */
fun nearestParticle(x: Float, y: Float, candidates: List<Particle>): Int {
    var best = -1
    var bestD2 = Float.POSITIVE_INFINITY
    for (i in candidates.indices) {
        val p = candidates[i].position
        val dx = p.x - x
        val dy = p.y - y
        val d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
            bestD2 = d2
            best = i
        }
    }
    return best
}

/** A wall segment between two Voronoi cells, in grid-node units (×step at draw time). */
data class GridSeg(val x1: Float, val y1: Float, val x2: Float, val y2: Float)

/**
 * The Voronoi cell walls of an owner grid (row-major [cols] × [rows] of site indices). A wall sits on
 * the shared edge between any two orthogonally-adjacent nodes whose owners differ (an unowned node is
 * -1); the vertical wall between columns gx and gx+1 lies at x = gx + 0.5.
 */
fun voronoiWalls(owners: IntArray, cols: Int, rows: Int): List<GridSeg> {
    val walls = ArrayList<GridSeg>()
    for (gy in 0 until rows) {
        for (gx in 0 until cols) {
            val o = owners[gy * cols + gx]
            if (gx + 1 < cols && owners[gy * cols + gx + 1] != o) {
                walls.add(GridSeg(gx + 0.5f, gy - 0.5f, gx + 0.5f, gy + 0.5f))
            }
            if (gy + 1 < rows && owners[(gy + 1) * cols + gx] != o) {
                walls.add(GridSeg(gx - 0.5f, gy + 0.5f, gx + 0.5f, gy + 0.5f))
            }
        }
    }
    return walls
}
