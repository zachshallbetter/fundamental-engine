import simd

/// The force + condition registry (§4, §5). The engine never changes to add a force —
/// register a module and a body opts in by carrying its token.
public final class Registry {
    public private(set) var forces: ForceRegistry = [:]
    public private(set) var conditions: ConditionRegistry = [:]

    public init() {}

    /// Register a force module (later registrations replace earlier ones, as in the JS).
    public func force(_ f: any Force) {
        forces[f.token] = f
    }

    /// Register a `when` gate predicate (§5).
    public func condition(_ id: String, _ fn: @escaping Condition) {
        conditions[id] = fn
    }

    /// A registry pre-loaded with the canonical nine and the natural primitives.
    public static func standard() -> Registry {
        let reg = Registry()
        for f in coreForces() { reg.force(f) }
        for f in naturalForces() { reg.force(f) }
        // built-in `when` gates (§5) — the engine-independent subset.
        reg.condition("active")   { b, _, _ in b.isEngaged }
        reg.condition("idle")     { b, _, _ in !b.isEngaged }
        reg.condition("scrolling") { _, _, env in (env?.scrollV ?? 0) > 0.5 }
        return reg
    }
}

// MARK: - Renderer seam

/// What a render backend needs each frame — the engine is renderer-agnostic, exactly as
/// the JS core never touches the canvas API directly outside its render module.
public protocol FieldRenderer: AnyObject {
    /// Draw one frame. `projection` maps 3D world space onto the surface.
    func render(frame: RenderFrame)
}

public struct RenderFrame {
    public let particles: [Particle]
    public let bodies: [Body]
    public let accent: RGB
    public let mode: RenderMode
    public let projection: any FieldProjection
    public let volume: FieldVolume

    public init(particles: [Particle], bodies: [Body], accent: RGB, mode: RenderMode,
                projection: any FieldProjection, volume: FieldVolume) {
        self.particles = particles
        self.bodies = bodies
        self.accent = accent
        self.mode = mode
        self.projection = projection
        self.volume = volume
    }
}
