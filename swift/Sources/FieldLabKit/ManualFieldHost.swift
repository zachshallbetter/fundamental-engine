import Foundation
import simd
import FundamentalCore

/// A FieldHost driven by hand — the snapshot pipeline's clock. `fire(at:)` advances one
/// frame synchronously; bodies are authored (no view tree), geometry is fixed.
public final class ManualFieldHost: FieldHost {
    public let fieldVolume: FieldVolume
    public var authoredBodies: [Body]
    private var frameCallback: ((TimeInterval) -> Void)?
    private(set) public var cancelled = false

    public init(width: Float, height: Float, depth: Float = 0, scale: Float = 2, bodies: [Body] = []) {
        self.fieldVolume = FieldVolume(width: width, height: height, depth: depth, scale: scale)
        self.authoredBodies = bodies
    }

    public var volume: FieldVolume { fieldVolume }
    public var scrollY: Float { 0 }
    public var scrollHeight: Float { 0 }
    public var prefersReducedMotion: Bool { false }
    public var isHidden: Bool { false }

    public var projection: any HostProjection {
        fieldVolume.depth > 0
            ? PerspectiveProjection(focalLength: max(fieldVolume.depth * 4, 200))
            : FlatProjection()
    }

    public func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        return NSObject()
    }

    public func cancelFrame(_ token: AnyObject) {
        cancelled = true
        frameCallback = nil
    }

    /// Advance one frame synchronously.
    public func fire(at time: TimeInterval) {
        frameCallback?(time)
    }

    public func onResize(_ cb: @escaping () -> Void) -> () -> Void { {} }
    public func onScroll(_ cb: @escaping () -> Void) -> () -> Void { {} }
    public func onVisibility(_ cb: @escaping () -> Void) -> () -> Void { {} }
    public func onInput(_ cb: @escaping () -> Void) -> () -> Void { {} }

    public func scanBodies() -> [Body] { authoredBodies }
    public func worldBox(of view: AnyObject) -> Box? { nil } // authored boxes are fixed
}
