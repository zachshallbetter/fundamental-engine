package com.fundamental.core

import com.fundamental.core.engine.AttnInput
import com.fundamental.core.engine.SpillBody
import com.fundamental.core.engine.attentionMuls
import com.fundamental.core.engine.spillover
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.createField
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Body-Matter-Interaction: conserved attention (§2.4), cross-boundary causality (Concept 4), and the
// density heatmap (H1). Each enacts a conservation law, checked headlessly.

class BmiTests {

    @Test
    fun attentionIsRestNeutral() {
        val muls = attentionMuls(listOf(AttnInput(1f, false), AttnInput(2f, false), AttnInput(1.5f, false)))
        assertTrue(muls.all { abs(it - 1f) < 1e-5f }, "nothing engaged → every multiplier is 1")
    }

    @Test
    fun attentionConservesTotalStrength() {
        val inputs = listOf(AttnInput(1f, true), AttnInput(1f, false), AttnInput(2f, false))
        val muls = attentionMuls(inputs)
        assertTrue(muls[0] > 1f, "the engaged body competes harder")
        assertTrue(muls[1] < 1f && muls[2] < 1f, "the others are drained")
        // Σ Sᵢ·mulᵢ == Σ Sᵢ (within the clamp; none hit the bounds here)
        val sumS = inputs.sumOf { it.strength.toDouble() }
        val sumSMul = inputs.indices.sumOf { (inputs[it].strength * muls[it]).toDouble() }
        assertEquals(sumS, sumSMul, 1e-3, "total strength is conserved")
    }

    @Test
    fun causalitySpilloverConservesAndFlowsToNeighbours() {
        // one saturated body (d high), two cool neighbours nearby.
        val bodies = listOf(
            SpillBody(0.9f, Vec3(100f, 100f, 0f)), // saturated → donates
            SpillBody(0.1f, Vec3(140f, 100f, 0f)),
            SpillBody(0.1f, Vec3(100f, 150f, 0f)),
        )
        val d = spillover(bodies)
        assertTrue(d[0] < 0f, "the saturated body donates")
        assertTrue(d[1] > 0f && d[2] > 0f, "neighbours receive")
        assertEquals(0.0, d.sum().toDouble(), 1e-4, "ΣΔ = 0 — conserved")
    }

    @Test
    fun heatmapSamplesWhereMatterPools() {
        val f = createField(400f, 400f, particleCount = 400, seed = 11)
        f.setHeatmap(true)
        // pull everything to one corner, then let the heatmap accumulate.
        f.flowTo(60f, 60f, strength = 2f, radius = 2000f)
        repeat(40) { f.tick() }
        val hot = f.sampleScalar(60f, 60f)
        val cold = f.sampleScalar(360f, 360f)
        assertTrue(hot > cold, "heatmap reads hotter where matter pooled ($hot vs $cold)")
        assertTrue(hot in 0f..1f, "normalized to [0,1]")
    }

    @Test
    fun attentionToggleDrivesTheField() {
        val f = createField(600f, 600f, particleCount = 50, seed = 3)
        f.addBody(com.fundamental.core.runtime.BodySpec(tokens = listOf("attract"), strength = 1f, rect = { com.fundamental.core.engine.Box(center = Vec3(300f, 300f, 0f)) }))
        // engaged via the body; with attention off, attn stays null
        f.tick()
        assertTrue(f.controller.bodies[0].attn == null, "attention off → neutral (null)")
        f.setAttention(true)
        f.tick()
        assertTrue(f.controller.bodies[0].attn != null, "attention on → a multiplier is allocated")
    }
}
