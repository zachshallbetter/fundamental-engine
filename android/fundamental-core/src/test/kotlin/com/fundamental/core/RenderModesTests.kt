package com.fundamental.core

import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.isoCross
import com.fundamental.core.engine.linkAlpha
import com.fundamental.core.engine.marchingCell
import com.fundamental.core.engine.nearestParticle
import com.fundamental.core.engine.nearestSite
import com.fundamental.core.engine.splatDensity
import com.fundamental.core.engine.voronoiWalls
import com.fundamental.core.math.Vec3
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Render-mode geometry (#1158) — the pure shapes behind links / metaballs / voronoi, ported from
// swift/Sources/FundamentalCore/Engine/RenderModes.swift. Host-free, so the Compose canvas and the
// JVM lab draw the same geometry and neither can drift from the Swift/JS treatment.

class RenderModesTests {

    // ── links ───────────────────────────────────────────────────────────────────────────────────

    @Test
    fun linkAlphaFadesToNothingAtTheRadius() {
        assertEquals(0.12f, linkAlpha(0f, 70f), 1e-6f, "coincident particles link at full alpha")
        assertEquals(0.06f, linkAlpha(35f, 70f), 1e-6f, "half the radius → half the alpha")
        assertEquals(0f, linkAlpha(70f, 70f), 1e-6f, "at the radius the link is gone")
        assertEquals(0f, linkAlpha(200f, 70f), 1e-6f, "and stays gone beyond it")
    }

    // ── metaballs: iso crossing + marching squares ───────────────────────────────────────────────

    @Test
    fun isoCrossInterpolatesTheCrossingAndHandlesAFlatEdge() {
        assertEquals(0.5f, isoCross(0f, 2f, 1f), 1e-6f, "the level sits midway between the corners")
        assertEquals(0.25f, isoCross(0f, 4f, 1f), 1e-6f)
        assertEquals(0.5f, isoCross(1f, 1f, 1f), 1e-6f, "a flat edge has no real crossing → 0.5")
        assertEquals(0f, isoCross(5f, 9f, 1f), 1e-6f, "clamped below")
        assertEquals(1f, isoCross(0f, 1f, 9f), 1e-6f, "clamped above")
    }

    @Test
    fun marchingCellIsEmptyWhenNoContourCrossesTheCell() {
        assertTrue(marchingCell(0f, 0f, 0f, 0f, 0.5f).isEmpty(), "all corners below → no skin")
        assertTrue(marchingCell(1f, 1f, 1f, 1f, 0.5f).isEmpty(), "all corners above → inside the blob")
    }

    @Test
    fun marchingCellCutsOneCornerOff() {
        // only bottom-left above the level (case 1) → a segment across the lower-left corner.
        val segs = marchingCell(0f, 0f, 0f, 1f, 0.5f)
        assertEquals(1, segs.size)
        val s = segs[0]
        assertTrue(s.x1 == 0f, "starts on the left edge")
        assertTrue(s.y2 == 1f, "ends on the bottom edge")
    }

    @Test
    fun marchingCellResolvesBothSaddles() {
        assertEquals(2, marchingCell(0f, 1f, 0f, 1f, 0.5f).size, "tr & bl above — the case-5 saddle")
        assertEquals(2, marchingCell(1f, 0f, 1f, 0f, 0.5f).size, "tl & br above — the case-10 saddle")
    }

    @Test
    fun marchingCellIsSymmetricUnderInversion() {
        // a case and its complement (c ↔ 15−c) describe the same contour — inside/outside swap only.
        for (c in 0..15) {
            val corner = { bit: Int -> if (c and bit != 0) 1f else 0f }
            val inv = { bit: Int -> if (c and bit != 0) 0f else 1f }
            val a = marchingCell(corner(8), corner(4), corner(2), corner(1), 0.5f)
            val b = marchingCell(inv(8), inv(4), inv(2), inv(1), 0.5f)
            assertEquals(a.size, b.size, "case $c and its inversion trace the same number of segments")
        }
    }

    // ── metaballs: the density splat ─────────────────────────────────────────────────────────────

    @Test
    fun splatDensityPeaksAtTheParticleAndVanishesOutsideTheRadius() {
        val cols = 9
        val rows = 9
        val step = 10f
        val grid = FloatArray(cols * rows)
        splatDensity(grid, cols, rows, step, px = 40f, py = 40f, radius = 25f)
        val atParticle = grid[4 * cols + 4] // node (4,4) == world (40,40)
        assertEquals(1f, atParticle, 1e-6f, "a node under the particle gets the full kernel weight")
        assertTrue(grid[4 * cols + 5] in 0f..atParticle, "a neighbour node is weaker than the peak")
        assertTrue(grid[4 * cols + 5] > 0f, "but still inside the kernel")
        assertEquals(0f, grid[0], 1e-6f, "a node beyond the radius is untouched")
    }

    @Test
    fun splatDensityIsAdditiveAcrossParticles() {
        val cols = 5
        val rows = 5
        val grid = FloatArray(cols * rows)
        splatDensity(grid, cols, rows, 10f, px = 20f, py = 20f, radius = 25f)
        val one = grid[2 * cols + 2]
        splatDensity(grid, cols, rows, 10f, px = 20f, py = 20f, radius = 25f)
        assertEquals(one * 2f, grid[2 * cols + 2], 1e-5f, "two particles splat twice the density — that is what makes a blob merge")
    }

    @Test
    fun splatDensityIgnoresANonPositiveRadius() {
        val grid = FloatArray(9)
        splatDensity(grid, 3, 3, 10f, px = 10f, py = 10f, radius = 0f)
        assertTrue(grid.all { it == 0f }, "a zero-radius kernel contributes nothing (and does not crash)")
    }

    // ── voronoi ─────────────────────────────────────────────────────────────────────────────────

    @Test
    fun nearestSitePicksTheClosestParticle() {
        val sites = listOf(Vec3(0f, 0f, 0f), Vec3(100f, 0f, 0f), Vec3(0f, 100f, 0f))
        assertEquals(0, nearestSite(5f, 5f, sites))
        assertEquals(1, nearestSite(90f, 10f, sites))
        assertEquals(2, nearestSite(10f, 90f, sites))
        assertEquals(-1, nearestSite(0f, 0f, emptyList()), "no sites → no owner")
    }

    @Test
    fun nearestParticlePicksTheClosestCandidate() {
        // the host sweeps the voronoi grid against a spatial-hash candidate list, so the pool variant
        // must agree with the position variant it mirrors.
        val pool = listOf(
            Particle(position = Vec3(0f, 0f, 0f)),
            Particle(position = Vec3(100f, 0f, 0f)),
            Particle(position = Vec3(0f, 100f, 0f)),
        )
        assertEquals(0, nearestParticle(5f, 5f, pool))
        assertEquals(1, nearestParticle(90f, 10f, pool))
        assertEquals(2, nearestParticle(10f, 90f, pool))
        assertEquals(-1, nearestParticle(0f, 0f, emptyList()), "no candidates → no owner")
        assertEquals(
            nearestSite(37f, 61f, pool.map { it.position }),
            nearestParticle(37f, 61f, pool),
            "the pool variant and the position variant agree",
        )
    }

    @Test
    fun voronoiWallsAreEmptyWhenEveryNodeSharesAnOwner() {
        val owners = IntArray(16) { 7 }
        assertTrue(voronoiWalls(owners, 4, 4).isEmpty(), "one cell owns the whole grid — nothing to shatter")
    }

    @Test
    fun voronoiWallsFollowTheOwnerBoundary() {
        // left half owned by 0, right half by 1 → one vertical wall per row, none horizontal.
        val cols = 4
        val rows = 3
        val owners = IntArray(cols * rows) { i -> if (i % cols < 2) 0 else 1 }
        val walls = voronoiWalls(owners, cols, rows)
        assertEquals(rows, walls.size, "one wall segment per row along the single boundary")
        assertTrue(walls.all { it.x1 == 1.5f && it.x2 == 1.5f }, "and every wall sits between columns 1 and 2")
    }
}
