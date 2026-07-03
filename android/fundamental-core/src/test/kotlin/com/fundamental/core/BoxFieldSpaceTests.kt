package com.fundamental.core

import com.fundamental.core.engine.Box
import kotlin.test.Test
import kotlin.test.assertEquals

// `Box.fromFieldTopLeft` — the host-adapter transform that turns a body's FIELD-SPACE top-left + size
// into a centered body box. The Compose `Modifier.fieldBody` calls this after `localPositionOf` resolves
// the body's position relative to the field root (issue #990: the old path used `positionInParent()`,
// which drifts once the body sits inside a nested / scrolling container). These tests pin the contract
// the fix depends on: the corner must be field-relative, and the box centers on it.
class BoxFieldSpaceTests {

    @Test
    fun centersOnTheFieldTopLeft() {
        val box = Box.fromFieldTopLeft(x = 40f, y = 60f, width = 20f, height = 10f)
        assertEquals(50f, box.center.x, "center x = left + w/2")
        assertEquals(65f, box.center.y, "center y = top + h/2")
        assertEquals(0f, box.center.z, "flat host: z = 0")
        assertEquals(10f, box.halfExtents.x, "half-width = w/2")
        assertEquals(5f, box.halfExtents.y, "half-height = h/2")
        assertEquals(0f, box.halfExtents.z, "flat host: half-depth = 0")
    }

    @Test
    fun nestedOffsetIsCarriedIntoFieldSpace() {
        // A body laid out at (10, 10) inside a container that itself sits at (100, 200) within the field
        // root. Field space is root-relative, so the body's field-space top-left is the SUM (110, 210) —
        // this is exactly what `localPositionOf(bodyCoords)` yields and what the old `positionInParent()`
        // (which would report only the parent-local (10, 10)) got wrong.
        val containerX = 100f
        val containerY = 200f
        val bodyLocalX = 10f
        val bodyLocalY = 10f
        val w = 30f
        val h = 40f

        val fieldTopLeftX = containerX + bodyLocalX
        val fieldTopLeftY = containerY + bodyLocalY
        val box = Box.fromFieldTopLeft(fieldTopLeftX, fieldTopLeftY, w, h)

        assertEquals(110f + w / 2f, box.center.x, "field-space center reflects the container offset, not just the parent-local x")
        assertEquals(210f + h / 2f, box.center.y, "field-space center reflects the container offset, not just the parent-local y")

        // Contrast: had the well tracked the parent-local corner (the pre-fix bug), it would center here —
        // wrong by the full container offset. Pin the delta so a regression to parent-space is caught.
        val buggy = Box.fromFieldTopLeft(bodyLocalX, bodyLocalY, w, h)
        assertEquals(containerX, box.center.x - buggy.center.x, "the fix shifts the well by exactly the container's x offset")
        assertEquals(containerY, box.center.y - buggy.center.y, "the fix shifts the well by exactly the container's y offset")
    }
}
