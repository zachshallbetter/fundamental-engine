package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldLineOpts
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.forceAt
import com.fundamental.core.engine.traceFieldLine
import com.fundamental.core.math.Vec3
import com.fundamental.core.overlay.Overlays
import com.fundamental.core.overlay.ScalarGrid2D
import com.fundamental.core.overlay.isoContours
import kotlin.test.Test
import kotlin.test.assertTrue

// Overlay readings — the field diagnostics. Computation is pure, so it's all checked headlessly.

class OverlayTests {
    private val forces = Registry.standardForces()

    private fun attractBody(cx: Float, cy: Float) =
        Body(tokens = listOf("attract"), strength = 2f, range = 800f, box = Box(center = Vec3(cx, cy, 0f))).apply { isVisible = true }

    @Test
    fun forceAtPointsTowardAnAttractor() {
        val bodies = listOf(attractBody(400f, 300f))
        val f = forceAt(bodies, forces, Vec3(200f, 300f, 0f)) // probe left of the body
        assertTrue(f.x > 0f, "the net push points toward the body (+x)")
        assertTrue(kotlin.math.abs(f.y) < kotlin.math.abs(f.x), "and is mostly horizontal on the axis")
    }

    @Test
    fun vectorFieldReturnsArrows() {
        val bodies = listOf(attractBody(400f, 300f))
        val segs = Overlays.vectorField(bodies, forces, 800f, 600f, spacing = 80f)
        assertTrue(segs.isNotEmpty(), "an attractor produces a vector field")
        // each arrow is a shaft + two barbs → segment count is a multiple of 3
        assertTrue(segs.size % 3 == 0, "arrows are shaft + 2 barbs")
    }

    @Test
    fun fieldLineFollowsAConstantField() {
        // a uniform +x field → the trace is a straight horizontal line through the seed
        val line = traceFieldLine({ Vec3(1f, 0f, 0f) }, Vec3(100f, 100f, 0f), FieldLineOpts(bounds = 400f to 400f, maxSteps = 50))
        assertTrue(line.size > 2, "the line advances")
        assertTrue(line.all { kotlin.math.abs(it.y - 100f) < 1e-3f }, "stays on the seed's row")
        assertTrue(line.last().x > line.first().x, "advances downstream in +x")
    }

    @Test
    fun gravityRadiatesFieldLines() {
        // gravity defines field(), so the structure-field reading is populated.
        val bodies = listOf(Body(tokens = listOf("gravity"), range = 900f, M = 5f, box = Box(center = Vec3(400f, 300f, 0f))).apply { isVisible = true })
        val segs = Overlays.fieldLines(bodies, forces, 800f, 600f, seedSpacing = 160f)
        assertTrue(segs.isNotEmpty(), "gravity's monopole field traces lines")
    }

    @Test
    fun marchingSquaresContoursAHotCenter() {
        // a 3×3 grid hot in the middle → a closed contour around the centre at a mid threshold
        val cols = 3; val rows = 3
        val data = floatArrayOf(
            0f, 0f, 0f,
            0f, 1f, 0f,
            0f, 0f, 0f,
        )
        val segs = isoContours(ScalarGrid2D(cols, rows, 50f, data), listOf(0.5f))
        assertTrue(segs.size >= 4, "the hot centre is ringed by contour segments (was ${segs.size})")
    }

    @Test
    fun deformationGridReturnsLattice() {
        val bodies = listOf(attractBody(400f, 300f))
        val segs = Overlays.deformationGrid(bodies, forces, 800f, 600f, spacing = 100f)
        assertTrue(segs.isNotEmpty(), "the deformation lattice has edges")
    }
}
