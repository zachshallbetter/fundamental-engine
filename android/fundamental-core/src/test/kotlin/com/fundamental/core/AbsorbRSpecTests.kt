package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * #1177 — `absorbR` had no path through `BodySpec` on either native plane, so a consumer holding a
 * BodyHandle was stuck at the Body default. That radius *is* the behaviour for `sink` (what it
 * captures) and sizes where `warp` ejects, and the engine's own tests reached through
 * `handle.body.absorbR` to work around it — a test proving something the public API could not express.
 */
class AbsorbRSpecTests {
    private fun box() = Box(center = Vec3(400f, 300f, 0f), halfExtents = Vec3(20f, 20f, 0f))

    @Test
    fun absorbRIsSettableThroughBodySpec() {
        val f = createField(800f, 600f, particleCount = 50, seed = 7)
        val h = f.addBody(BodySpec(tokens = listOf("sink"), absorbR = 90f, rect = { box() }))
        assertEquals(90f, h.body.absorbR, "the spec value must reach the body")
    }

    @Test
    fun omittingItKeepsTheBodyDefault() {
        val f = createField(800f, 600f, particleCount = 50, seed = 7)
        val h = f.addBody(BodySpec(tokens = listOf("sink"), rect = { box() }))
        assertEquals(10f, h.body.absorbR, "default must be unchanged by this addition")
    }
}
