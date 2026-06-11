import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Viewport / Volume

/// The render surface's current dimensions.
/// `depth` is the z extent of the simulation volume: 0 = the flat field (every formula
/// reduces to the JS 2D math exactly); > 0 = a volumetric field — a shallow opt-in
/// volume on iOS/macOS (`FieldField(in:depth:)`), real meters on visionOS.
public struct FieldVolume {
    public var width: Float
    public var height: Float
    public var depth: Float
    public var scale: Float      // display scale factor (DPR equivalent)

    public init(width: Float, height: Float, depth: Float = 0, scale: Float = 1) {
        self.width = width
        self.height = height
        self.depth = depth
        self.scale = scale
    }

    public var size3: Vec3 { Vec3(width, height, depth) }
}

// MARK: - FieldProjection

/// Maps a 3D world position to a 2D render point (and a depth hint for size/opacity effects).
/// Implement this on the host to control how the physics volume is projected onto a surface.
public protocol FieldProjection {
    /// Project `p` to a 2D point in the render surface's coordinate space.
    func project(_ p: Vec3) -> (x: Float, y: Float)
    /// Depth hint ∈ [0,1] for size/opacity effects. 0 = at surface; 1 = far back.
    func depthHint(_ p: Vec3) -> Float
}

/// Flat projection — z is ignored. The depth-0 (flat field) default on iOS and macOS.
public struct FlatProjection: FieldProjection {
    public init() {}
    public func project(_ p: Vec3) -> (x: Float, y: Float) { (p.x, p.y) }
    public func depthHint(_ p: Vec3) -> Float { 0 }
}

/// Shallow perspective projection — z gives a size/opacity nudge without leaving 2D.
/// `strength` controls how much z deflects the projected position (default 0 = flat).
public struct PerspectiveProjection: FieldProjection {
    public var focalLength: Float
    public var strength: Float

    public init(focalLength: Float = 500, strength: Float = 0.1) {
        self.focalLength = focalLength
        self.strength = strength
    }

    public func project(_ p: Vec3) -> (x: Float, y: Float) {
        let scale = focalLength / max(focalLength - p.z * strength, 1)
        return (p.x * scale, p.y * scale)
    }

    public func depthHint(_ p: Vec3) -> Float { clamp(-p.z / focalLength, 0, 1) }
}

// MARK: - FieldHost

/// The platform seam — everything the engine needs from the surrounding runtime.
/// Implement this once per platform target (iOS, macOS, visionOS).
/// Equivalent to `browserHost()` in @field-ui/platform.
public protocol FieldHost: AnyObject {
    // ── geometry ──────────────────────────────────────────────────────────
    var volume: FieldVolume { get }
    /// Current scroll offset in the y axis (units). 0 when not applicable.
    var scrollY: Float { get }
    /// Total scrollable height. 0 when not applicable.
    var scrollHeight: Float { get }

    // ── system signals ────────────────────────────────────────────────────
    var prefersReducedMotion: Bool { get }
    var isHidden: Bool { get }

    // ── loop ──────────────────────────────────────────────────────────────
    /// Schedule a display-sync callback. Returns a cancellation token.
    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject
    func cancelFrame(_ token: AnyObject)

    // ── events ────────────────────────────────────────────────────────────
    /// Called on resize. Returns unsubscribe closure.
    func onResize(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on scroll. Returns unsubscribe closure.
    func onScroll(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on visibility change. Returns unsubscribe closure.
    func onVisibility(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on any user input gesture (tap/drag/pinch…). Returns unsubscribe closure.
    func onInput(_ callback: @escaping () -> Void) -> () -> Void

    // ── projection ────────────────────────────────────────────────────────
    /// How the 3D world is projected onto the render surface.
    var projection: any FieldProjection { get }

    // ── body scanning ─────────────────────────────────────────────────────
    /// Walk the view hierarchy and return bodies found (the `[data-body]` scanner equivalent).
    func scanBodies() -> [Body]
    /// Geometry of a view in world space. Returns nil if not available.
    func worldBox(of view: AnyObject) -> Box?
}
