package com.fundamental.platform

import com.fundamental.core.engine.Body
import java.util.IdentityHashMap

// The platform registries — ported from Registries.swift line-for-line.
//
// Registries that key on element identity (StateRegistry) use an IdentityHashMap so that two
// distinct Body instances never collide even if they compare equal: this mirrors Swift's
// `ObjectIdentifier(body)` keying exactly. (Body is a reference-semantics `class` in core, so
// `===` identity is the intended key — `IdentityHashMap` reproduces that contract.)

// ── Supporting types ────────────────────────────────────────────────────────
//
// OverlayMode / OverlayInput / FeedbackSink / FeedbackChannels are declared in Swift's
// FundamentalCore (Engine/FieldHandle.swift) and consumed here. The Kotlin core port of
// FieldHandle.swift does not exist yet, so the minimal slice this file needs is defined inline.
// TODO(parity): move these to com.fundamental.core.engine when FieldHandle.swift is ported,
// then import them here instead of redeclaring.

/** Overlay reading modes — additive (§Field Surfaces). */
enum class OverlayMode { OFF, STREAMLINES, FORCE_VECTORS, FIELD_LINES, GRID, TEMPERATURE, ENERGY, PATH, DATA }

/** One or more additive overlay readings. */
sealed interface OverlayInput {
    data class Single(val mode: OverlayMode) : OverlayInput
    data class Stack(val modes: List<OverlayMode>) : OverlayInput
}

/** Per-element feedback the engine produces each frame (Phase D3 seam). */
data class FeedbackChannels(
    var density: Float? = null,
    var heatmapDensity: Float? = null,
    var load: Float? = null,
    var lit: Float? = null,
    var entropy: Float? = null,
    var coherence: Float? = null,
    var temperature: Float? = null,
)

/** Receives a body's feedback in place of direct attribute writes. */
typealias FeedbackSink = (view: Any, channels: FeedbackChannels) -> Unit

// ── StateRegistry ───────────────────────────────────────────────────────────

/** Holds the current semantic state for each body — the in-frame truth, no platform writes. */
class StateRegistry {
    // IdentityHashMap reproduces Swift's `ObjectIdentifier(body)` keying: identity, never equality.
    private val entries: IdentityHashMap<Body, BodyState> = IdentityHashMap()

    fun set(state: BodyState, body: Body) {
        entries[body] = state
    }

    fun get(body: Body): BodyState? = entries[body]

    fun remove(body: Body) {
        entries.remove(body)
    }
}

data class BodyState(
    var density: Float = 0f,
    var load: Float = 0f,
    var lit: Float = 0f,
    var entropy: Float = 0f,
    var coherence: Float = 0f,
    var temperature: Float = 0f,
)

// ── FeedbackRegistry ─────────────────────────────────────────────────────────

/**
 * Flushes the accumulated state into platform-level output (attribute writes, callbacks…).
 * Write phase only — never reads geometry.
 */
class FeedbackRegistry(private var sink: FeedbackSink? = null) {

    fun setSink(sink: FeedbackSink?) {
        this.sink = sink
    }

    /** Flush the current state to each body's platform representation. */
    fun flush(state: StateRegistry, now: Double) {
        // Concrete flush implemented in platform targets
        // (the UIKit host writes to UIView.layer / SwiftUI environment)
    }
}

// ── RelationshipRegistry ─────────────────────────────────────────────────────

/** Tracks declared relationships between bodies — shared density spill, causality chains. */
class RelationshipRegistry {
    data class Relationship(
        var from: Body,
        var to: Body,
        var kind: String,
    )

    private val relationships: MutableList<Relationship> = mutableListOf()

    fun add(r: Relationship) {
        relationships.add(r)
    }

    fun remove(from: Body, to: Body) {
        // `===` mirrors Swift's identity comparison (`$0.from === from && $0.to === to`).
        relationships.removeAll { it.from === from && it.to === to }
    }

    fun relationships(from: Body): List<Relationship> =
        relationships.filter { it.from === from }
}

// ── VisualBindingRegistry ─────────────────────────────────────────────────────

/**
 * Maps semantic state lanes to visual outputs — the `data-field-visual-for` equivalent.
 * In Swift: SwiftUI `.fieldVisual(for:)` modifier registers here.
 */
class VisualBindingRegistry {
    data class Binding(
        var body: Body,
        var lane: String,    // "density", "temperature", "entropy"…
        var target: Any,     // Swift's `AnyObject` → Kotlin `Any`.
    )

    private val bindings: MutableList<Binding> = mutableListOf()

    fun bind(body: Body, lane: String, target: Any) {
        bindings.add(Binding(body, lane, target))
    }

    fun bindings(body: Body): List<Binding> =
        bindings.filter { it.body === body }
}

// ── OverlayRegistry ───────────────────────────────────────────────────────────

/**
 * Manages diagnostic overlay layers (streamlines, heatmap, field-lines…).
 * Render phase only — reads from MeasurementRegistry snapshot, writes to overlay canvas/layer.
 */
class OverlayRegistry {
    var activeOverlays: List<OverlayMode> = emptyList()
        private set

    fun setOverlay(input: OverlayInput) {
        when (input) {
            is OverlayInput.Single -> activeOverlays = if (input.mode == OverlayMode.OFF) emptyList() else listOf(input.mode)
            is OverlayInput.Stack -> activeOverlays = input.modes.filter { it != OverlayMode.OFF }
        }
    }

    val isEmpty: Boolean get() = activeOverlays.isEmpty()
}
