package com.fundamental.core

import com.fundamental.core.engine.ParticleShape
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// ParticleShape (§render) — unit vector shapes the host stamps per particle. Ported from Swift; the
// vertex math is checked exactly.

class ParticleShapeTests {

    @Test
    fun dotIsTheFastCirclePath() {
        assertTrue(ParticleShape.DOT.isDot)
        assertNull(ParticleShape.DOT.vertices)
    }

    @Test
    fun starHasTwoVerticesPerPointAlternatingRadius() {
        val s = ParticleShape.star(points = 5, innerRatio = 0.5f)
        val v = s.vertices!!
        assertEquals(10, v.size, "5-point star → 10 vertices (outer+inner)")
        // even indices are the outer points (radius 1), odd are the waist (radius 0.5)
        assertEquals(1f, kotlin.math.hypot(v[0].x, v[0].y), 1e-4f)
        assertEquals(0.5f, kotlin.math.hypot(v[1].x, v[1].y), 1e-4f)
        // first point straight up: angle −π/2 → (0, −1)
        assertTrue(kotlin.math.abs(v[0].x) < 1e-4f && v[0].y < 0f, "first point is straight up")
        assertTrue(!s.isDot)
    }

    @Test
    fun polygonIsNUnitVertices() {
        val tri = ParticleShape.polygon(sides = 3)
        assertEquals(3, tri.vertices!!.size)
        tri.vertices!!.forEach { assertEquals(1f, kotlin.math.hypot(it.x, it.y), 1e-4f, "polygon vertices are unit-radius") }
        // sides clamps to ≥ 3
        assertEquals(3, ParticleShape.polygon(sides = 1).vertices!!.size)
        assertEquals(6, ParticleShape.polygon(sides = 6).vertices!!.size)
    }

    @Test
    fun customCarriesTheGivenVertices() {
        val verts = listOf(com.fundamental.core.math.Vec3(0f, -1f, 0f), com.fundamental.core.math.Vec3(1f, 1f, 0f), com.fundamental.core.math.Vec3(-1f, 1f, 0f))
        assertEquals(verts, ParticleShape.custom(verts).vertices)
    }
}
