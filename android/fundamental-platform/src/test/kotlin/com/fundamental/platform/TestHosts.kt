package com.fundamental.platform

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldProjection
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.engine.FlatProjection

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
