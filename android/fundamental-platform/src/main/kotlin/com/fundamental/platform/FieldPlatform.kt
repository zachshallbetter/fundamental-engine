package com.fundamental.platform

import com.fundamental.core.engine.FieldHost

// MARK: - FieldPlatform

/**
 * The coordinator that binds the platform registries to one shared FrameScheduler.
 * Mirrors `createFieldPlatform` from @fundamental-engine/platform.
 *
 * The scheduler owns loop discipline: every frame walks
 *   discover → read → compute → state → write → render
 *
 * By default the platform wires `read` (MeasurementRegistry) and `write` (FeedbackRegistry).
 * Callers add `discover`/`compute`/`state`/`render` handlers with `platform.on(_:_:)`.
 */
class FieldPlatform(
    val host: FieldHost,
    options: PlatformOptions = PlatformOptions(),
) {
    val measure: MeasurementRegistry = MeasurementRegistry()
    val state: StateRegistry = StateRegistry()
    val feedback: FeedbackRegistry = FeedbackRegistry()
    val relationships: RelationshipRegistry = RelationshipRegistry()
    val visuals: VisualBindingRegistry = VisualBindingRegistry()
    val overlays: OverlayRegistry = OverlayRegistry()
    val scheduler: FrameScheduler = FrameScheduler(strict = options.strict)

    init {
        // Read-phase discipline: measurement consults the scheduler before reading geometry.
        measure.setPhaseGuard(scheduler.readGuard())

        // The two phases the registries own outright.
        scheduler.on(Phase.READ) { ctx ->
            measure.measure(now = ctx.now, volume = ctx.volume, host = host)
        }
        scheduler.on(Phase.WRITE) { ctx ->
            feedback.flush(state = state, now = ctx.now)
        }
    }

    /** Register a phase handler. Returns unsubscribe closure. */
    fun on(phase: Phase, handler: PhaseHandler): () -> Unit {
        return scheduler.on(phase, handler)
    }

    /** Run one full six-phase frame. */
    fun tick(now: Double = 0.0): FrameReport {
        return scheduler.runFrame(now = now, volume = host.volume)
    }
}

data class PlatformOptions(
    var strict: Boolean = false,
)
