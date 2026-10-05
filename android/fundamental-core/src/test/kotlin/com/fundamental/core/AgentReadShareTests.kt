package com.fundamental.core

import com.fundamental.core.runtime.AgentReadShare
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertTrue

// #915 — the fractional `budgets.agentRead` gate.
//
// The digest that picks WHICH bodies a partial read admits must be bit-identical on every plane, or
// the same policy over the same field admits different bodies depending on where it runs — a parity
// break nothing else in the suite would catch. These vectors come from the JS engine's `idCoord` and
// are duplicated verbatim in the Swift and JS tests.
class AgentReadShareTests {

    private val vectors = listOf(
        "body-0" to 0.65820098831318319,
        "body-1" to 0.39754880708642304,
        "body-2" to 0.90072084194980562,
        "a" to 0.10352621669881046,
        "hero" to 0.83324211370199919,
        "b00" to 0.28318144241347909,
        "b63" to 0.07492343452759087,
        "card-42" to 0.51497967774048448,
        "" to 0.66892218845896423,
        "ünïcode" to 0.78291085967794061,
    )

    @Test
    fun `the digest matches the JS engine bit for bit`() {
        for ((id, expected) in vectors) {
            val got = AgentReadShare.coordinate(id)
            assertTrue(abs(got - expected) < 1e-15, "coordinate($id) = $got, JS says $expected")
        }
    }

    @Test
    fun `the boundaries are the documented ones`() {
        assertTrue(AgentReadShare.admits("body-2", 1f))
        assertTrue(AgentReadShare.admits("body-2", 2f))
        assertTrue(!AgentReadShare.admits("hero", 0.5f))
        assertTrue(AgentReadShare.admits("hero", 0.9f))
    }

    @Test
    fun `the share is roughly uniform over realistic ids`() {
        val ids = (0 until 512).map { "body-$it" }
        for (share in listOf(0.1f, 0.25f, 0.5f, 0.75f)) {
            val admitted = ids.count { AgentReadShare.admits(it, share) }
            val expected = share.toDouble() * 512
            assertTrue(
                abs(admitted - expected) < 512 * 0.06,
                "share $share admitted $admitted/512, expected about $expected",
            )
        }
    }
}
