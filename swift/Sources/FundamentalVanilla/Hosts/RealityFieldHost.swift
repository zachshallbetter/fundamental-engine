#if canImport(RealityKit)
import RealityKit
import SwiftUI
import FundamentalCore
import FundamentalPlatform

// MARK: - RealityFieldHost

/// The FieldHost implementation for visionOS (RealityKit / SwiftUI).
///
/// Unlike iOS/macOS, visionOS uses the full 3D volume — depth is real,
/// not zero. The simulation runs in native volumetric space and is rendered
/// directly by a RealityKit Entity hierarchy.
///
/// Projection: identity (particles live in 3D world space; no 2D projection needed).
final class RealityFieldHost: FieldHost {
    /// The root RealityKit Entity that owns the simulation volume.
    public let root: Entity
    /// World-space volume the simulation occupies (in meters on visionOS).
    public let fieldVolume: FieldVolume
    private var frameCallback: ((TimeInterval) -> Void)?
    private var updateTask: Task<Void, Never>?

    public init(root: Entity, width: Float = 1.0, height: Float = 0.6, depth: Float = 0.4) {
        self.root = root
        self.fieldVolume = FieldVolume(width: width, height: height, depth: depth, scale: 1)
    }

    // MARK: FieldHost — geometry

    public var volume: FieldVolume { fieldVolume }
    public var scrollY: Float { 0 }
    public var scrollHeight: Float { 0 }

    public var prefersReducedMotion: Bool { false }   // no system API on visionOS 1.0
    public var isHidden: Bool { false }

    // MARK: FieldHost — loop

    /// Drive the engine from a SwiftUI TimelineView's update — call `tick(date:)` from
    /// `.onChange(of: context.date)` in your TimelineView content, which forwards here.
    public func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        // Actual tick is driven externally by TimelineView or a scene update subscription.
        return NSObject()
    }

    public func cancelFrame(_ token: AnyObject) {
        updateTask?.cancel()
        updateTask = nil
        frameCallback = nil
    }

    /// Call this from your RealityView update closure or TimelineView.
    public func tick(time: TimeInterval) {
        frameCallback?(time)
    }

    // MARK: FieldHost — events

    public func onResize(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onScroll(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onVisibility(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onInput(_ callback: @escaping () -> Void) -> () -> Void { { } }

    // MARK: FieldHost — projection (identity — already 3D world space)

    public var projection: any HostProjection { IdentityProjection() }

    // MARK: FieldHost — body scanning

    /// Walk the Entity hierarchy for entities with a FieldBodyComponent.
    public func scanBodies() -> [Body] {
        var bodies: [Body] = []
        walk(entity: root, into: &bodies)
        return bodies
    }

    private func walk(entity: Entity, into bodies: inout [Body]) {
        // Bind through an explicit `(any Component)?`: across RealityKit SDK versions the
        // `components[T.self]` subscript resolves to either `T?` or `(any Component)?` (the latter,
        // on the CI runner's SDK, has no `.body`). The annotation upcasts implicitly on the first and
        // is identity on the second, so the downcast then reads `.body` warning-free on both.
        let component: (any Component)? = entity.components[FieldBodyComponent.self]
        if let field = component as? FieldBodyComponent {
            bodies.append(field.body)
        }
        for child in entity.children { walk(entity: child, into: &bodies) }
    }

    public func worldBox(of ref: AnyObject) -> Box? {
        guard let entity = ref as? Entity else { return nil }
        let pos = entity.position(relativeTo: nil)
        // Use the entity's visual bounds if available; fall back to a unit box.
        let bounds = entity.visualBounds(relativeTo: nil)
        let ext = bounds.extents * 0.5
        return Box(
            center:      Vec3(pos.x, pos.y, pos.z),
            halfExtents: Vec3(ext.x, ext.y, ext.z)
        )
    }
}

// MARK: - IdentityProjection

/// No projection — particles live directly in 3D world space.
public struct IdentityProjection: HostProjection {
    public func project(_ p: Vec3) -> (x: Float, y: Float) { (p.x, p.y) }
    public func depthHint(_ p: Vec3) -> Float { 0 }
}

// MARK: - FieldBodyComponent

/// A RealityKit Component that marks an Entity as a field body.
public struct FieldBodyComponent: Component {
    public var body: Body

    public init(body: Body) {
        self.body = body
    }
}

#endif
