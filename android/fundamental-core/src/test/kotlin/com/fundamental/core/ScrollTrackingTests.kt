package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertTrue

// Scroll body-centre tracking — the JS #508 invariant, pinned natively (#509).
//
// The JS core re-measures body geometry only every 6th frame (getBoundingClientRect can force
// synchronous layout), so #508 translates the cached centres by the per-frame scroll delta
// between measures — without it the attractors snap in 6-frame steps during a scroll and the
// swarm reads as "pausing". The Kotlin runtime has no measure throttle: FieldController.tick
// re-samples every rect-closure body each frame (and view-backed boxes are pushed per frame by
// the hosts), so centres track a scroll/pan with zero staleness by construction, and a delta
// shift would double-count the scroll already present in the fresh sample. These tests pin that
// invariant so a future measure cadence can't silently reintroduce the JS bug without porting
// the compensation (with its contained guard).

class ScrollTrackingTests {

    @Test
    fun windowMountTracksScrollEveryTick() {
        val fc = FieldController(width = 375f, height = 812f, particleCount = 100, seed = 5)
        val docY = 600f
        var scroll = 0f
        // The fixed-overlay (window) mount: the page scrolls under the field, so the body's
        // viewport position is its document position minus the live scroll.
        val body = Body(tokens = listOf("attract"), strength = 2f, range = 400f)
        body.rect = { Box(center = Vec3(187f, docY - scroll, 0f), halfExtents = Vec3(50f, 25f, 0f)) }
        fc.addBody(body)

        // Scroll 8px per tick for 24 ticks. The body's box must sit at the fresh viewport
        // position after EVERY tick — the "plateau fraction 0" verification from JS #508.
        repeat(24) { i ->
            scroll = (i + 1) * 8f
            fc.tick()
            assertTrue(
                abs(body.box.center.y - (docY - scroll)) < 1e-4f,
                "tick ${i + 1}: the centre must track the live scroll, not a stale measure",
            )
        }
    }

    @Test
    fun forceCentreFollowsScroll() {
        val fc = FieldController(width = 375f, height = 812f, particleCount = 100, seed = 5)
        val docY = 600f
        var scroll = 0f
        val body = Body(tokens = listOf("attract"), strength = 2f, range = 400f)
        body.rect = { Box(center = Vec3(187f, docY - scroll, 0f), halfExtents = Vec3(50f, 25f, 0f)) }
        fc.addBody(body)

        // Probe a fixed viewport point the body scrolls PAST (600 → 408 crosses 500). The force's
        // y-component at the probe must flip sign as the true centre crosses it — a stale centre
        // (stuck at document y = 600) would keep the same sign the whole way.
        var early = 0f
        var late = 0f
        repeat(24) { i ->
            scroll = (i + 1) * 8f
            fc.tick()
            val f = fc.sample(187f, 500f)
            if (i + 1 == 2) early = f.y // body viewport y = 584 — below the probe
            if (i + 1 == 24) late = f.y // body viewport y = 408 — above the probe
        }
        assertTrue(early != 0f && late != 0f, "the attract body exerts force at the probe")
        assertTrue((early > 0f) != (late > 0f), "the force direction flips as the tracked centre crosses the probe")
    }

    @Test
    fun containedMountGeometryIsLeftUntouched() {
        val fc = FieldController(width = 375f, height = 812f, particleCount = 100, seed = 5)
        val docY = 600f
        // A contained mount scrolls WITH its bodies (the JS `!contained` guard, #540): the
        // geometry is scroll-invariant. The engine must not shift it by any scroll delta.
        val body = Body(tokens = listOf("attract"), strength = 2f, range = 400f)
        body.rect = { Box(center = Vec3(187f, docY, 0f), halfExtents = Vec3(50f, 25f, 0f)) }
        fc.addBody(body)

        repeat(24) { i ->
            fc.tick()
            assertTrue(
                abs(body.box.center.y - docY) < 1e-4f,
                "tick ${i + 1}: a scroll-invariant box must not be scroll-shifted by the engine",
            )
        }
    }
}
