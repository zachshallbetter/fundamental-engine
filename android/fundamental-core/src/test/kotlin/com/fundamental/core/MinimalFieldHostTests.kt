package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.engine.FlatProjection
import com.fundamental.core.engine.MinimalFieldHost
import com.fundamental.core.engine.defineHost
import com.fundamental.core.engine.hostCapabilities
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// MinimalFieldHost + host capability model (JS #888) — a host supplies only geometry + time; the engine
// degrades gracefully around every absent optional capability.

class MinimalFieldHostTests {

    /** A host supplying ONLY the required core — no scroll, no reduced-motion, no visibility, no events. */
    private class BareHost : MinimalFieldHost {
        override val volume = FieldVolume(800f, 600f)
        override val projection = FlatProjection()
        override fun scanBodies(): List<Body> = emptyList()
        override fun worldBox(view: Any): Box? = null
        override fun scheduleFrame(callback: (Double) -> Unit): Any = 0
        override fun cancelFrame(token: Any) {}
    }

    @Test
    fun minimalHostGetsGracefulDefaultsThroughDefineHost() {
        val host: FieldHost = defineHost(BareHost())
        // optional capabilities degrade to their graceful defaults
        assertTrue(host.scrollY == 0f)
        assertFalse(host.prefersReducedMotion)
        assertFalse(host.isHidden)
        // subscriptions are inert no-ops (never throw, return an unsubscribe)
        host.onResize { }.invoke()
        host.onInput { }.invoke()
    }

    @Test
    fun capabilitiesReflectWhatTheHostSupplies() {
        val bare: FieldHost = defineHost(BareHost())
        val bareCaps = hostCapabilities(bare)
        assertTrue(bareCaps.geometry && bareCaps.time)
        assertFalse(bareCaps.scroll)
        assertFalse(bareCaps.reducedMotion)
        assertFalse(bareCaps.visibility)

        val capable: FieldHost = defineHost(
            BareHost(),
            scrollY = { 120f },
            prefersReducedMotion = { true },
            isHidden = { true },
        )
        val caps = hostCapabilities(capable)
        assertTrue(caps.scroll)
        assertTrue(caps.reducedMotion)
        assertTrue(caps.visibility)
    }
}
