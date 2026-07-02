package com.fundamental.platform

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldProjection
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.engine.FlatProjection
import com.fundamental.core.math.Vec3
import java.util.IdentityHashMap

// Shared minimal headless FieldHosts for the platform tests.

/** A host whose worldBox returns each body's own pre-set box. */
internal class TestHost(private val vol: FieldVolume) : FieldHost {
    override val volume: FieldVolume get() = vol
    override val scrollY = 0f
    override val scrollHeight = 0f
    override val prefersReducedMotion = false
    override val isHidden = false
    override fun scheduleFrame(callback: (Double) -> Unit): Any = Any()
    override fun cancelFrame(token: Any) {}
    override fun onResize(callback: () -> Unit): () -> Unit = {}
    override fun onScroll(callback: () -> Unit): () -> Unit = {}
    override fun onVisibility(callback: () -> Unit): () -> Unit = {}
    override fun onInput(callback: () -> Unit): () -> Unit = {}
    override val projection: FieldProjection = FlatProjection()
    override fun scanBodies(): List<Body> = emptyList()
    override fun worldBox(view: Any): Box? = (view as? Body)?.box
}

/**
 * A host that simulates a scrolling mount (#508/#509): `worldBox` answers each body's document
 * box translated by the live [scroll] — the fixed-overlay geometry where the page scrolls under
 * the field. Tests set [scroll] between measures to verify the registry re-reads fresh geometry
 * on every call.
 */
internal class ScrollingTestHost(private val vol: FieldVolume) : FieldHost {
    var scroll: Float = 0f
    val docBoxes: IdentityHashMap<Any, Box> = IdentityHashMap()

    override val volume: FieldVolume get() = vol
    override val scrollY: Float get() = scroll
    override val scrollHeight = 2000f
    override val prefersReducedMotion = false
    override val isHidden = false
    override fun scheduleFrame(callback: (Double) -> Unit): Any = Any()
    override fun cancelFrame(token: Any) {}
    override fun onResize(callback: () -> Unit): () -> Unit = {}
    override fun onScroll(callback: () -> Unit): () -> Unit = {}
    override fun onVisibility(callback: () -> Unit): () -> Unit = {}
    override fun onInput(callback: () -> Unit): () -> Unit = {}
    override val projection: FieldProjection = FlatProjection()
    override fun scanBodies(): List<Body> = emptyList()
    override fun worldBox(view: Any): Box? {
        val doc = docBoxes[view] ?: return null
        return Box(
            center = Vec3(doc.center.x, doc.center.y - scroll, doc.center.z),
            halfExtents = doc.halfExtents,
        )
    }
}

/** A host that never resolves a world box — exercises MeasurementRegistry's drop path. */
internal class NullBoxHost(private val vol: FieldVolume) : FieldHost {
    override val volume: FieldVolume get() = vol
    override val scrollY = 0f
    override val scrollHeight = 0f
    override val prefersReducedMotion = false
    override val isHidden = false
    override fun scheduleFrame(callback: (Double) -> Unit): Any = Any()
    override fun cancelFrame(token: Any) {}
    override fun onResize(callback: () -> Unit): () -> Unit = {}
    override fun onScroll(callback: () -> Unit): () -> Unit = {}
    override fun onVisibility(callback: () -> Unit): () -> Unit = {}
    override fun onInput(callback: () -> Unit): () -> Unit = {}
    override val projection: FieldProjection = FlatProjection()
    override fun scanBodies(): List<Body> = emptyList()
    override fun worldBox(view: Any): Box? = null
}
