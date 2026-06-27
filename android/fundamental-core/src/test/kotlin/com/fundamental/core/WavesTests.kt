package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.buildBound
import com.fundamental.core.engine.buildWaves
import com.fundamental.core.engine.induceCharges
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Carrier waves (§24) + the bound↔free reservoir (§2.4). The waves are deterministic data; the
// reservoir conserves total matter (free + bound) as it heals and tears.

class WavesTests {

    @Test
    fun buildWavesMakesFiveLayeredCurrents() {
        val w = buildWaves(emptyList())
        assertEquals(5, w.size)
        assertEquals(0f, w.first().depth, 1e-6f)
        assertEquals(1f, w.last().depth, 1e-6f)
        assertTrue(w[0].dir == 1f && w[1].dir == -1f, "directions alternate")
    }

    @Test
    fun buildBoundScalesWithDensityAndWaveCount() {
        val bound = buildBound(waveCount = 5, density = 2f, rand = { 0.5f })
        assertEquals(5 * 32, bound.size, "round(16·density) = 32 riders per wave × 5 waves")
    }

    @Test
    fun induceChargesPolarizesMatterNearAChargeBody() {
        val body = Body(tokens = listOf("charge"), range = 300f, box = Box(center = Vec3.ZERO))
        body.isVisible = true
        val right = Particle(position = Vec3(100f, 0f, 0f))
        val left = Particle(position = Vec3(-100f, 0f, 0f))
        induceCharges(listOf(body), listOf(right, left))
        // d3 = center − position, so the +x-side particle gets −1 and the −x-side gets +1 (a two-domain split).
        assertTrue(right.charge != null && right.charge!! < 0f, "matter on the +x side polarizes one way")
        assertTrue(left.charge != null && left.charge!! > 0f, "matter on the −x side polarizes the other")
        assertTrue(right.charge != left.charge, "the two sides get opposite signs")
    }

    @Test
    fun reservoirConservesTotalMatter() {
        val f = createField(800f, 600f, particleCount = 400, seed = 21)
        f.setWaves(true)
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 2f, range = 500f, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        val total0 = f.particleCount() + f.controller.bound.size
        assertTrue(f.controller.waves.size == 5 && f.controller.bound.isNotEmpty(), "waves + shimmer built")
        repeat(80) { f.tick() }
        val total1 = f.particleCount() + f.controller.bound.size
        assertEquals(total0, total1, "free + bound matter is conserved across heal/tear")
    }
}
