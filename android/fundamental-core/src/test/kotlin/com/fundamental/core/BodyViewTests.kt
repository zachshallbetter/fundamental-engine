package com.fundamental.core

import com.fundamental.core.engine.Body
import kotlin.test.Test
import kotlin.test.assertNull
import kotlin.test.assertSame

// `Body.view` — the opaque platform handle a body tracks (Types.kt). Mirrors Swift's
// `weak var view: AnyObject?`: held weakly, null by default, and read/written through the accessor.
// MeasurementRegistry keys `worldBox` on this handle, so the round-trip contract is load-bearing.
class BodyViewTests {

    @Test
    fun viewDefaultsToNull() {
        val body = Body(tokens = listOf("attract"))
        assertNull(body.view, "a body has no view until one is assigned")
    }

    @Test
    fun viewRoundTripsTheAssignedHandle() {
        val body = Body(tokens = listOf("attract"))
        val handle = Any()
        body.view = handle
        assertSame(handle, body.view, "the assigned handle reads back by identity")
    }

    @Test
    fun viewCanBeCleared() {
        val body = Body(tokens = listOf("attract"))
        body.view = Any()
        body.view = null
        assertNull(body.view, "clearing the view returns to null")
    }
}
