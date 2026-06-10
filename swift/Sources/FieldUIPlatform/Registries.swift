import Foundation
import FieldUICore

// MARK: - StateRegistry

/// Holds the current semantic state for each body — the in-frame truth, no platform writes.
public final class StateRegistry {
    private var entries: [ObjectIdentifier: BodyState] = [:]

    public func set(_ state: BodyState, for body: Body) {
        entries[ObjectIdentifier(body)] = state
    }

    public func get(for body: Body) -> BodyState? {
        entries[ObjectIdentifier(body)]
    }

    public func remove(for body: Body) {
        entries.removeValue(forKey: ObjectIdentifier(body))
    }
}

public struct BodyState {
    public var density: Float
    public var load: Float
    public var lit: Float
    public var entropy: Float
    public var coherence: Float
    public var temperature: Float

    public init(
        density: Float = 0,
        load: Float = 0,
        lit: Float = 0,
        entropy: Float = 0,
        coherence: Float = 0,
        temperature: Float = 0
    ) {
        self.density = density
        self.load = load
        self.lit = lit
        self.entropy = entropy
        self.coherence = coherence
        self.temperature = temperature
    }
}

// MARK: - FeedbackRegistry

/// Flushes the accumulated state into platform-level output (attribute writes, callbacks…).
/// Write phase only — never reads geometry.
public final class FeedbackRegistry {
    private var sink: FeedbackSink?

    public init(sink: FeedbackSink? = nil) {
        self.sink = sink
    }

    public func setSink(_ sink: FeedbackSink?) {
        self.sink = sink
    }

    /// Flush the current state to each body's platform representation.
    public func flush(state: StateRegistry, now: TimeInterval) {
        // Concrete flush implemented in platform targets
        // (the UIKit host writes to UIView.layer / SwiftUI environment)
    }
}

// MARK: - RelationshipRegistry

/// Tracks declared relationships between bodies — shared density spill, causality chains.
public final class RelationshipRegistry {
    public struct Relationship {
        public var from: Body
        public var to: Body
        public var kind: String
    }

    private var relationships: [Relationship] = []

    public func add(_ r: Relationship) {
        relationships.append(r)
    }

    public func remove(from: Body, to: Body) {
        relationships.removeAll { $0.from === from && $0.to === to }
    }

    public func relationships(from body: Body) -> [Relationship] {
        relationships.filter { $0.from === body }
    }
}

// MARK: - VisualBindingRegistry

/// Maps semantic state lanes to visual outputs — the `data-field-visual-for` equivalent.
/// In Swift: SwiftUI `.fieldVisual(for:)` modifier registers here.
public final class VisualBindingRegistry {
    public struct Binding {
        public var body: Body
        public var lane: String     // "density", "temperature", "entropy"…
        public var target: AnyObject
    }

    private var bindings: [Binding] = []

    public func bind(body: Body, lane: String, to target: AnyObject) {
        bindings.append(Binding(body: body, lane: lane, target: target))
    }

    public func bindings(for body: Body) -> [Binding] {
        bindings.filter { $0.body === body }
    }
}

// MARK: - OverlayRegistry

/// Manages diagnostic overlay layers (streamlines, heatmap, field-lines…).
/// Render phase only — reads from MeasurementRegistry snapshot, writes to overlay canvas/layer.
public final class OverlayRegistry {
    private(set) var activeOverlays: [OverlayMode] = []

    public func setOverlay(_ input: OverlayInput) {
        switch input {
        case .single(let m):  activeOverlays = m == .off ? [] : [m]
        case .stack(let ms):  activeOverlays = ms.filter { $0 != .off }
        }
    }

    public var isEmpty: Bool { activeOverlays.isEmpty }
}
