import simd

// MARK: - Agent kinds

public enum AgentKind {
    case particle
    case element
    case eventSink
}

// MARK: - Particle  (§3.2, §21)

/// A free particle — the lightest agent.
/// All positions and velocities are 3D. On 2D platforms, z ≈ 0.
public struct Particle {
    public var position: Vec3
    public var velocity: Vec3
    /// Inertial mass — 1 = nominal (§21). Under first-class mass ∝ size.
    public var mass: Float
    /// ∈ [0,1]; drives color (toward accent), size, and glow (§2.2).
    public var heat: Float
    /// Render-radius basis.
    public var size: Float
    /// The sink/blackhole body holding this particle, or nil (§6.9).
    public weak var cap: Body?

    // Formation scatter targets (§7)
    public var gx: Float?
    public var gy: Float?
    public var gz: Float?

    // Extended-force attributes (§20)
    /// Frames-to-live for mortal (spawned) matter; nil = immortal.
    public var age: Int?
    /// Signed charge q, for `charge` / `magnetism` (§20.10).
    public var charge: Float?
    /// Species tag, for `hunt` (§20.3).
    public var species: Int?
    /// Carried pigment, conserved color transport (§20.8).
    public var color: String?
    /// Opaque data record bound by `FieldHandle.seed`.
    public var atom: AtomPayload?

    public init(
        position: Vec3 = .zero,
        velocity: Vec3 = .zero,
        mass: Float = 1,
        heat: Float = 0,
        size: Float = 1
    ) {
        self.position = position
        self.velocity = velocity
        self.mass = mass
        self.heat = heat
        self.size = size
    }
}

/// Opaque data record bindable to a particle via `FieldHandle.seed`.
/// `weight` (0..1) scales that particle's mass + size.
public struct AtomPayload: Sendable {
    public var weight: Float?
    public var payload: [String: any Sendable]

    public init(weight: Float? = nil, payload: [String: any Sendable] = [:]) {
        self.weight = weight
        self.payload = payload
    }
}

// MARK: - Body  (§3.1)

/// A registered view acting as a force source.
/// Parsed from platform-specific attribute equivalents; runtime fields refreshed each scan/frame.
public final class Body: AnyObject {
    // ── identity ────────────────────────────────────────────────────────────
    /// Opaque platform reference (UIView, NSView, Entity…). Weak to avoid retain cycles.
    public weak var view: AnyObject?
    /// Space-joined force ids (they compose, §4).
    public var tokens: [String]
    public var classified: ClassifiedTokens?

    // ── field parameters ────────────────────────────────────────────────────
    public var strength: Float
    public var range: Float
    public var absorbR: Float
    public var capacity: Float
    public var spin: Float
    /// Heading in 3D — the dipole axis, orbit axis, jet direction.
    public var heading: Vec3
    public var when: String
    public var feedback: Bool
    public var tint: String?
    public var shaped: Bool
    public var fmin: Float
    public var fmax: Float

    // Warp / wormhole (§22.3)
    public var pairTag: String?
    public var twist: Float?
    public var warpScale: Float?

    // Source budget (§20)
    public var life: Int?
    public var cap_: Int?          // renamed to avoid collision with Particle.cap
    public var budgeted: Bool
    public var screenMin: Float?

    // ── 3D geometry (refreshed each scan frame) ─────────────────────────────
    public var box: Box
    /// Source mass M for `gravity`/`charge` (§20.10/§21).
    public var M: Float

    // ── runtime state ────────────────────────────────────────────────────────
    public var isEngaged: Bool       // hover/focus/tap → active
    public var isVisible: Bool       // on-screen and exerting force (§2.1)
    public var accreted: Float       // captured load (was `mass`, §21.2)
    public var count: Int            // per-frame density tally
    public var d: Float              // eased density value ∈ [0,1]
    public var attn: Float?          // conserved-attention strength multiplier (§2.4)
    public var emitAcc: Float?       // fractional-emission accumulator for budgeted [S] sources

    // Resolved warp pairing (set each scan)
    public weak var pairBody: Body?
    public var warpTarget: Vec3?
    public var warpHas: Bool

    // Thermodynamic accumulators (workover §"Metrics")
    public var thermo: Thermo?
    public var metrics: Metrics?

    // Morph targets (§20.3 [D])
    public var targets: [Vec3]?

    public init(
        tokens: [String],
        strength: Float = 1,
        range: Float = 100,
        absorbR: Float = 10,
        capacity: Float = 30,
        spin: Float = 1,
        heading: Vec3 = Vec3(0, -1, 0),
        when: String = "",
        feedback: Bool = false,
        shaped: Bool = false,
        fmin: Float = 0,
        fmax: Float = 1,
        budgeted: Bool = false,
        box: Box = Box(center: .zero, halfExtents: .zero),
        M: Float = 1
    ) {
        self.tokens = tokens
        self.strength = strength
        self.range = range
        self.absorbR = absorbR
        self.capacity = capacity
        self.spin = spin
        self.heading = heading
        self.when = when
        self.feedback = feedback
        self.shaped = shaped
        self.fmin = fmin
        self.fmax = fmax
        self.budgeted = budgeted
        self.box = box
        self.M = M
        self.isEngaged = false
        self.isVisible = false
        self.accreted = 0
        self.count = 0
        self.d = 0
        self.warpHas = false
    }

    public struct Thermo {
        public var n: Int
        public var sv: Vec3     // Σvelocity
        public var ss: Float    // Σ|v|
        public var ss2: Float   // Σ|v|²
        public var sh: Float    // Σheat
    }

    public struct Metrics {
        public var entropy: Float       // ∈ [0,1]
        public var coherence: Float     // ∈ [0,1]
        public var temperature: Float   // ∈ [0,1]
    }
}

/// Token classification result — mirrors `ClassifiedTokens` from the JS config.
public struct ClassifiedTokens {
    public var modifiers: [String]
    public var forces: [String]
    public var sources: [String]
}

// MARK: - Formation  (§7)

/// A global bias on every free particle.
public struct Formation: Sendable {
    public var driftX: Float
    public var wander: Float
    public var orbit: Float
    public var spread: Float
    public var conv: Float

    public static let neutral = Formation(driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0)
}

// MARK: - Scalar grid  (§20.1 class [C])

public protocol ScalarGrid {
    func sample(at p: Vec3) -> Float
    func deposit(at p: Vec3, amount: Float)
    func gradient(at p: Vec3) -> Vec3
}

// MARK: - Env  (§3.3)

/// The shared per-frame environment handed to every force.
/// `vector` is the body→particle vector (3D). On 2D platforms, z=0.
public struct Env {
    /// Vector from particle to body: (body.center − particle.position).
    public var vector: Vec3
    /// |vector|, clamped ≥ 1.
    public var dist: Float
    /// The active, eased formation (§7).
    public var form: Formation
    /// World volume (width, height, depth). Depth = 0 on 2D platforms.
    public var volume: Vec3
    /// Elapsed time in seconds.
    public var t: Float
    /// Frame counter.
    public var frameN: Int
    /// Integration step: 1 a frame, 0 under reduced motion (§2.2/§18).
    public var dt: Float
    /// Velocity cap / "speed of light" (§20.10).
    public var c: Float
    /// Gravitational constant (§20.10).
    public var G: Float
    /// Recent scroll speed (eased, units/frame); 0 when inactive.
    public var scrollV: Float

    // ── services (closures filled by the engine) ──────────────────────────
    public var spark: (_ at: Vec3, _ power: Float, _ color: String?) -> Void
    public var supernova: (_ body: Body) -> Void
    public var spawn: (_ partial: Particle) -> Void
    public var neighbors: (_ p: Particle, _ r: Float) -> [Particle]
    public var grid: (_ name: String) -> any ScalarGrid
    /// Net structure field at a world point (dipoles + monopoles).
    public var fieldAt: ((_ p: Vec3) -> Vec3)?
}

// MARK: - Force  (§4)

/// A force module. The engine owns the loop; a force owns only the math.
public protocol Force {
    var token: String { get }
    var label: String { get }
    var targets: [AgentKind] { get }

    /// Apply this force to a free particle. Mutate `p` in place.
    func apply(body: Body, particle: inout Particle, env: Env)

    /// True if this force replaces velocity (kinematic) rather than adding an acceleration.
    /// Kinematic forces are not scaled by 1/m under first-class mass (§21.3).
    var isKinematic: Bool { get }

    /// Optional modifier hook — run before the body's other tokens.
    func modify(body: Body, particle: Particle, env: Env) -> ForceModification?

    /// Optional source hook — run once per body per frame to create matter.
    func source(body: Body, env: Env)

    /// Optional visual field hook — the structure field this body projects at a world point.
    func field(body: Body, at p: Vec3) -> Vec3?

    /// Optional scalar field hook — a potential, density, or temperature at a world point.
    func scalarField(body: Body, at p: Vec3) -> Float?
}

public struct ForceModification {
    /// Multiplies sibling forces' strength for this particle.
    public var strength: Float?
    /// When true, skips all sibling forces entirely.
    public var gate: Bool
}

// Default no-ops so concrete types only implement what they need.
public extension Force {
    var targets: [AgentKind] { [.particle] }
    var isKinematic: Bool { false }
    func modify(body: Body, particle: Particle, env: Env) -> ForceModification? { nil }
    func source(body: Body, env: Env) {}
    func field(body: Body, at p: Vec3) -> Vec3? { nil }
    func scalarField(body: Body, at p: Vec3) -> Float? { nil }
}

// MARK: - Thread connector  (§10)

public struct ThreadLink {
    public var a: AnyObject
    public var b: AnyObject
    public var color: String?
}

// MARK: - Condition  (§5)

public typealias Condition = (_ body: Body, _ particle: Particle, _ env: Env?) -> Bool

// MARK: - Registries

public typealias ForceRegistry = [String: any Force]
public typealias ConditionRegistry = [String: Condition]
