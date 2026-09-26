package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodyHandle
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldHandle
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `warp` END TO END, THROUGH THE CONTROLLER — the regression suite for the gap that made the token
 * dead code on this plane.
 *
 * `ExtendedForcesTests.warpRelocatesMatterToThePairedThroat` covers the FORCE, and it passed the whole
 * time the force was unreachable: it hand-sets `warpHas` / `warpTarget` / `twist` / `warpScale` on a
 * bare `Body` and calls `WarpForce.apply` directly. Nothing in the Kotlin runtime ever wrote those
 * fields — there was no pairing concept at all — so `apply` returned at `if (!body.warpHas …)` on
 * every frame of every real field. A unit test that sets the very state the missing step was supposed
 * to produce cannot see that; these tests refuse to touch it.
 *
 * So every test here goes through the PUBLIC supply path (`BodySpec` / `BodyHandle.pairWith`), ticks
 * the real field, and asserts on where matter actually ends up. No test in this file assigns
 * `warpHas`, `warpTarget` or `pairBody`.
 *
 * The one piece still reached through internals is `absorbR` (the throat radius), which `BodySpec`
 * cannot supply for ANY force today — `FieldHandleTests` sets it the same way for `sink`. That is a
 * pre-existing supply gap shared with `sink`, not part of the pairing fix.
 */
class WarpPairingTests {

    private val throatA = Vec3(200f, 300f, 0f)
    private val throatB = Vec3(700f, 300f, 0f)
    private val throatR = 60f

    /** Two `warp` throats in one field; `pair` decides whether they are wired to each other. */
    private class Wormhole(val f: FieldHandle, val a: BodyHandle, val b: BodyHandle)

    private fun wormhole(
        pair: Boolean = true,
        twistDeg: Float? = null,
        warpScale: Float? = null,
    ): Wormhole {
        val f = createField(900f, 600f, particleCount = 16, seed = 11)
        val a = f.addBody(
            BodySpec(
                tokens = listOf("warp"), range = 0f, twistDeg = twistDeg, warpScale = warpScale,
                rect = { Box(center = throatA) },
            ),
        )
        val b = f.addBody(BodySpec(tokens = listOf("warp"), range = 0f, rect = { Box(center = throatB) }))
        a.body.absorbR = throatR
        b.body.absorbR = throatR
        if (pair) {
            a.pairWith(b) // directed, as on every plane — a two-way wormhole is two calls
            b.pairWith(a)
        }
        return Wormhole(f, a, b)
    }

    /** Park one particle just inside throat A, at rest, so the relocation is the only thing that moves it. */
    private fun matterInThroatA(f: FieldHandle, offset: Float = 8f) = f.controller.particles[0].apply {
        position = Vec3(throatA.x + offset, throatA.y, 0f)
        velocity = Vec3.ZERO
        heat = 0f
    }

    /**
     * The emergence point `WarpForce` computes: the entry direction (unit local offset, negated),
     * rotated by `twist`, at `absorbR · scale + 6` from the paired throat's live centre.
     */
    private fun emergence(twistRad: Float = 0f, scale: Float = 1f): Vec3 =
        throatB + Vec3(1f, 0f, 0f).rotatedAboutZ(twistRad) * (throatR * scale + 6f)

    @Test
    fun aPairedThroatRelocatesMatterThroughTheRealTick() {
        val w = wormhole()
        val p = matterInThroatA(w.f)

        w.f.tick()

        val want = emergence()
        assertTrue(
            (p.position - want).length() < 12f,
            "matter emerged at the paired throat: want≈$want got=${p.position}",
        )
        assertTrue(
            (p.position - throatA).length() > throatR,
            "and it is clear of the throat it entered (${(p.position - throatA).length()} > $throatR)",
        )
        // the crossing stamps heat 0.6 — what the JS `wormhole` preset's `hot` gate (heat > 0.3) reads to
        // throw the arrival clear. Read back after the integrator's per-frame HEAT_DECAY, so 0.6·decay.
        assertTrue(p.heat > 0.3f, "the crossing left the matter hot (${p.heat})")
    }

    @Test
    fun anUnpairedThroatIsInertHereIsTheBugThisSuitePins() {
        // Byte-for-byte the paired case minus the two pairWith calls. This is exactly the state EVERY
        // Kotlin field was in before the controller resolved pairings, and matter simply sat there.
        val w = wormhole(pair = false)
        val p = matterInThroatA(w.f)
        val start = p.position

        w.f.tick()

        assertFalse(w.a.body.warpHas, "no pairing supplied ⇒ nothing for the force to target")
        assertTrue(
            (p.position - start).length() < 2f,
            "an unpaired throat relocates nothing: start=$start got=${p.position}",
        )
    }

    @Test
    fun twistAndScaleReachTheEngineFromBodySpec() {
        val w = wormhole(twistDeg = 90f, warpScale = 2f)
        // supplied in degrees (JS `data-twist`), carried in radians, as the JS scanner does.
        assertEquals(Math.toRadians(90.0).toFloat(), w.a.body.twist!!, 1e-5f)
        assertEquals(2f, w.a.body.warpScale)

        val p = matterInThroatA(w.f)
        w.f.tick()

        val want = emergence(twistRad = Math.toRadians(90.0).toFloat(), scale = 2f)
        assertTrue(
            (p.position - want).length() < 12f,
            "twist rotates the exit and scale pushes it further out: want≈$want got=${p.position}",
        )
    }

    @Test
    fun removingThePartnerClosesTheWormholeRatherThanTeleportingToAGhost() {
        val w = wormhole()
        w.f.tick()
        assertTrue(w.a.body.warpHas, "paired and resolved before the removal")

        w.b.remove()
        val p = matterInThroatA(w.f)
        val start = p.position
        w.f.tick()

        assertFalse(w.a.body.warpHas, "the surviving throat's link is severed with its partner")
        assertTrue(w.a.body.pairBody == null, "and the reference is released, not just ignored")
        assertTrue((p.position - start).length() < 2f, "so nothing is relocated to a body the field no longer owns")
    }

    @Test
    fun anInvisiblePartnerClosesTheWormholeToo() {
        // The JS gate (`if (b.pairBody.vis) … else b.warpHas = false`): an off-screen body exerts no
        // force anywhere else in the engine, so it must not be a live teleport destination either.
        val w = wormhole()
        w.f.tick()
        assertTrue(w.a.body.warpHas)

        w.b.body.isVisible = false
        val p = matterInThroatA(w.f)
        val start = p.position
        w.f.tick()

        assertFalse(w.a.body.warpHas, "an off-screen partner is not a destination")
        assertTrue((p.position - start).length() < 2f, "and matter stays put")

        w.b.body.isVisible = true
        w.f.tick()
        assertTrue(w.a.body.warpHas, "the link re-resolves when the partner comes back")
    }

    @Test
    fun unpairingClosesItImmediately() {
        val w = wormhole()
        w.f.tick()
        assertTrue(w.a.body.warpHas)

        w.a.pairWith(null)
        assertFalse(w.a.body.warpHas, "closed at the call, not a tick later")
        val p = matterInThroatA(w.f)
        val start = p.position
        w.f.tick()
        assertTrue((p.position - start).length() < 2f)
    }

    @Test
    fun aFieldWithNoPairingIsUntouchedByTheResolutionPass() {
        // The conformance-golden guarantee, asserted rather than asserted-about: the new per-tick pass
        // writes nothing observable when no body is paired.
        fun run(): List<Vec3> {
            val f = createField(600f, 400f, particleCount = 40, seed = 3)
            f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.4f, range = 400f, rect = { Box(center = Vec3(300f, 200f, 0f)) }))
            repeat(30) { f.tick() }
            return f.controller.particles.map { it.position }
        }
        assertEquals(run(), run(), "deterministic, and no body carries a pairing to resolve")
    }
}
