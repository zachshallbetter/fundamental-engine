import Foundation
import FieldUICore

// MARK: - FieldPlatform

/// The coordinator that binds the platform registries to one shared FrameScheduler.
/// Mirrors `createFieldPlatform` from @fundamental-engine/platform.
///
/// The scheduler owns loop discipline: every frame walks
///   discover → read → compute → state → write → render
///
/// By default the platform wires `read` (MeasurementRegistry) and `write` (FeedbackRegistry).
/// Callers add `discover`/`compute`/`state`/`render` handlers with `platform.on(_:_:)`.
public final class FieldPlatform {
    public let host: any FieldHost
    public let measure: MeasurementRegistry
    public let state: StateRegistry
    public let feedback: FeedbackRegistry
    public let relationships: RelationshipRegistry
    public let visuals: VisualBindingRegistry
    public let overlays: OverlayRegistry
    public let scheduler: FrameScheduler

    public init(host: any FieldHost, options: PlatformOptions = .init()) {
        self.host = host
        self.measure = MeasurementRegistry()
        self.state = StateRegistry()
        self.feedback = FeedbackRegistry()
        self.relationships = RelationshipRegistry()
        self.visuals = VisualBindingRegistry()
        self.overlays = OverlayRegistry()
        self.scheduler = FrameScheduler(strict: options.strict)

        // Read-phase discipline: measurement consults the scheduler before reading geometry.
        measure.setPhaseGuard(scheduler.readGuard())

        // The two phases the registries own outright.
        scheduler.on(.read) { [weak self] ctx in
            guard let self else { return }
            self.measure.measure(now: ctx.now, volume: ctx.volume, host: host)
        }
        scheduler.on(.write) { [weak self] ctx in
            guard let self else { return }
            self.feedback.flush(state: self.state, now: ctx.now)
        }
    }

    /// Register a phase handler. Returns unsubscribe closure.
    @discardableResult
    public func on(_ phase: Phase, _ handler: @escaping PhaseHandler) -> () -> Void {
        scheduler.on(phase, handler)
    }

    /// Run one full six-phase frame.
    @discardableResult
    public func tick(now: TimeInterval = 0) -> FrameReport {
        scheduler.runFrame(now: now, volume: host.volume)
    }
}

public struct PlatformOptions {
    public var strict: Bool

    public init(strict: Bool = false) {
        self.strict = strict
    }
}
