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

    /// A registry pre-loaded with the canonical nine, the natural primitives, the
    /// extended set, and the built-in `when` gates (§5) — the full JS surface.
    public static func standard() -> Registry {
        let reg = Registry()
        for f in coreForces() { reg.force(f) }
        for f in naturalForces() { reg.force(f) }
        for f in extendedForces() { reg.force(f) }
        for (id, fn) in builtinConditions() { reg.condition(id, fn) }
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

/// A spark — a micro-reaction particle (§23). Engine-owned pool, renderer-drawn.
public struct Spark {
    public var position: Vec3
    public var velocity: Vec3
    public var life: Float   // 1 → 0
    public var color: RGB

    public init(position: Vec3, velocity: Vec3, life: Float, color: RGB) {
        self.position = position
        self.velocity = velocity
        self.life = life
        self.color = color
    }
}

public struct RenderFrame {
    public let particles: [Particle]
    public let bodies: [Body]
    public let accent: RGB
    public let mode: RenderMode
    public let projection: any FieldProjection
    public let volume: FieldVolume
    /// Elapsed sim time (s) — waves and overlays are time-varying.
    public let time: Float
    /// The carrier waves (§2.3), empty when waves are off.
    public let waves: [Wave]
    /// The bound shimmer riding the waves (§2.4).
    public let bound: [BoundParticle]
    /// Live sparks (§23).
    public let sparks: [Spark]
    /// The density heatmap, when enabled (H1).
    public let heatmap: Heatmap?
    /// Active overlay readings (drawn in order on the front surface).
    public let overlays: [OverlayMode]
    /// Probe the net felt force at a point (streamlines / force-vectors readings).
    public let forceSampler: (Vec3) -> Vec3
    /// Probe the structure-only field at a point (field-lines reading).
    public let fieldSampler: (Vec3) -> Vec3
    /// The active flow focus, if any — overlay arrows bend toward it like the felt field does.
    public let flow: FlowFocus?
    /// Resolved glowing-connector segments (§10), drawn over the field with travelling pulses.
    public let threads: [ThreadSegment]

    public init(particles: [Particle], bodies: [Body], accent: RGB, mode: RenderMode,
                projection: any FieldProjection, volume: FieldVolume,
                time: Float = 0, waves: [Wave] = [], bound: [BoundParticle] = [],
                sparks: [Spark] = [], heatmap: Heatmap? = nil, overlays: [OverlayMode] = [],
                forceSampler: @escaping (Vec3) -> Vec3 = { _ in .zero },
                fieldSampler: @escaping (Vec3) -> Vec3 = { _ in .zero },
                flow: FlowFocus? = nil, threads: [ThreadSegment] = []) {
        self.flow = flow
        self.threads = threads
        self.particles = particles
        self.bodies = bodies
        self.accent = accent
        self.mode = mode
        self.projection = projection
        self.volume = volume
        self.time = time
        self.waves = waves
        self.bound = bound
        self.sparks = sparks
        self.heatmap = heatmap
        self.overlays = overlays
        self.forceSampler = forceSampler
        self.fieldSampler = fieldSampler
    }
}
