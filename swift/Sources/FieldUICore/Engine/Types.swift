import Foundation
import simd

// MARK: - Agent kinds

public enum AgentKind: Sendable {
    case particle
    case element
    case eventSink
}

// MARK: - Particle  (§3.2, §21)

/// A free particle — the lightest agent.
///
/// A reference type, deliberately: the integrator mutates particles through neighbour
/// lists (`collide` exchanges momentum with `q` directly, exactly as the JS engine does),
/// and capture (`cap`) is an identity relationship. All positions/velocities are 3D;
/// on 2D platforms z stays 0.
public final class Particle {
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

    /// Stable per-particle scatter target fractions, for the `spread` formation (§7).
    public var gx: Float
    public var gy: Float
    public var gz: Float

    // Extended-force attributes (§20)
    /// Frames-to-live for mortal (spawned) matter; nil = immortal (the conserved base field).
    public var age: Float?
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
        size: Float = 1,
        gx: Float = 0.5,
        gy: Float = 0.5,
        gz: Float = 0.5
    ) {
        self.position = position
        self.velocity = velocity
        self.mass = mass
        self.heat = heat
        self.size = size
        self.gx = gx
        self.gy = gy
        self.gz = gz
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
public final class Body {
    // ── identity ────────────────────────────────────────────────────────────
    /// Opaque platform reference (UIView, NSView, Entity…). Weak to avoid retain cycles.
    public weak var view: AnyObject?
    /// Space-joined force ids (they compose, §4).
    public var tokens: [String]
    /// Memoized token classification (filled lazily by the integrator).
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
    /// Shaped source: forces reference the nearest point on the box, not its centre.
    public var shaped: Bool
    public var fmin: Float
    public var fmax: Float

    // Warp / wormhole (§22.3)
    public var pairTag: String?
    public var twist: Float?
    public var warpScale: Float?

    // Source budget (§20)
    public var life: Float?
    public var sourceCap: Int?
    public var budgeted: Bool
    public var screenMin: Float?

    // ── 3D geometry (refreshed each scan frame) ─────────────────────────────
    public var box: Box
    /// Source mass M for `gravity`/`charge` (§20.10/§21).
    public var M: Float

    // ── runtime state ────────────────────────────────────────────────────────
    public var isEngaged: Bool       // hover/focus/tap → active (`b.on` in JS)
    public var isVisible: Bool       // on-screen and exerting force (§2.1)
    public var accreted: Float       // captured load (was `mass`, §21.2)
    public var count: Float          // per-frame density tally
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

    // Convenience geometry accessors (the JS cx/cy/hw/hh)
    @inline(__always) public var center: Vec3 { box.center }

    public struct Thermo {
        public var n: Int = 0
        public var sv: Vec3 = .zero   // Σvelocity
        public var ss: Float = 0      // Σ|v|
        public var ss2: Float = 0     // Σ|v|²
        public var sh: Float = 0      // Σheat
        public init() {}
    }

    public struct Metrics {
        public var entropy: Float = 0       // ∈ [0,1]
        public var coherence: Float = 0     // ∈ [0,1]
        public var temperature: Float = 0   // ∈ [0,1]
        public init() {}
    }
}

/// Token classification — `{ modifiers, forces, sources }` per the modifier contract
/// (workover v0.3). Modifiers carry the formalized order `spotlight → screen → resonate`.
public struct ClassifiedTokens {
    public var modifiers: [String]
    public var forces: [String]

    public init(modifiers: [String], forces: [String]) {
        self.modifiers = modifiers
        self.forces = forces
    }
}

/// The formalized modifier order (workover v0.3): spotlight → screen → resonate.
public let MODIFIER_ORDER: [String] = ["spotlight", "screen", "resonate"]

/// Split a body's tokens into modifiers (in contract order) and forces (in authored order).
public func classifyBodyTokens(_ tokens: [String]) -> ClassifiedTokens {
    var modifiers: [String] = []
    for m in MODIFIER_ORDER where tokens.contains(m) { modifiers.append(m) }
    let forces = tokens.filter { !MODIFIER_ORDER.contains($0) }
    return ClassifiedTokens(modifiers: modifiers, forces: forces)
}

// MARK: - Formation  (§7)

/// A global bias on every free particle.
public struct Formation: Sendable {
    public var driftX: Float
    public var wander: Float
    public var orbit: Float
    public var spread: Float
    public var conv: Float

    public init(driftX: Float = 0, wander: Float = 0, orbit: Float = 0, spread: Float = 0, conv: Float = 0) {
        self.driftX = driftX
        self.wander = wander
        self.orbit = orbit
        self.spread = spread
        self.conv = conv
    }

    public static let neutral = Formation()
}

// MARK: - Scalar grid  (§20.1 class [C])

public protocol ScalarGrid: AnyObject {
    func sample(at p: Vec3) -> Float
    func deposit(at p: Vec3, amount: Float)
    func gradient(at p: Vec3) -> Vec3
}

/// A grid that holds nothing — the default until the scalar-grid port lands.
/// Grid-backed forces (`diffuse`, `propagate`, `memory`) no-op against it.
public final class NoopGrid: ScalarGrid {
    public init() {}
    public func sample(at p: Vec3) -> Float { 0 }
    public func deposit(at p: Vec3, amount: Float) {}
    public func gradient(at p: Vec3) -> Vec3 { .zero }
}

// MARK: - Env  (§3.3)

/// The shared per-frame environment handed to every force.
///
/// A reference type: the integrator updates `vector`/`dist` per body–particle pair in the
/// hot loop (exactly as the JS engine mutates `env.dx/dy/dist`), and forces read it.
public final class Env {
    /// Vector from particle to body: (body.center − particle.position).
    public var vector: Vec3 = .zero
    /// |vector|, clamped ≥ 1.
    public var dist: Float = 1
    /// The active, eased formation (§7).
    public var form: Formation = .neutral
    /// World volume (width, height, depth). Depth = 0 on 2D platforms.
    public var volume: Vec3 = .zero
    /// Elapsed time in seconds.
    public var t: Float = 0
    /// Frame counter.
    public var frameN: Int = 0
    /// Integration step: 1 a frame, 0 under reduced motion (§2.2/§18).
    public var dt: Float = 1
    /// Velocity cap / "speed of light" (§20.10).
    public var c: Float = 12
    /// Gravitational constant (§20.10).
    public var G: Float = 1
    /// Recent scroll speed (eased, units/frame); 0 when inactive.
    public var scrollV: Float = 0

    // ── services (closures filled by the engine) ──────────────────────────
    public var spark: (_ at: Vec3, _ power: Float, _ color: String?) -> Void = { _, _, _ in }
    public var supernova: (_ body: Body) -> Void = { _ in }
    public var spawn: (_ p: Particle) -> Void = { _ in }
    public var neighbors: (_ p: Particle, _ r: Float) -> [Particle] = { _, _ in [] }
    public var grid: (_ name: String) -> any ScalarGrid = { _ in NoopGrid() }
    /// Net structure field at a world point (dipoles + monopoles). Set by the integrator.
    public var fieldAt: ((_ p: Vec3) -> Vec3)?

    public init() {}
}

// MARK: - Force  (§4)

/// A force module. The engine owns the loop; a force owns only the math.
public protocol Force {
    var token: String { get }
    var label: String { get }
    var targets: [AgentKind] { get }

    /// Apply this force to a free particle (mutates the particle).
    func apply(body: Body, particle: Particle, env: Env)

    /// True if this force replaces velocity (a reflection, rotation, or relaunch) rather
    /// than adding an acceleration — first-class mass must not scale it (§21.3).
    var isKinematic: Bool { get }

    /// Whether this force implements `modify` — the JS engine checks `f.modify` existence;
    /// Swift protocols can't, so modifier forces declare it. Default false.
    var hasModify: Bool { get }

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

    public init(strength: Float? = nil, gate: Bool = false) {
        self.strength = strength
        self.gate = gate
    }
}

// Default no-ops so concrete types only implement what they need.
public extension Force {
    var targets: [AgentKind] { [.particle] }
    var isKinematic: Bool { false }
    var hasModify: Bool { false }
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

    public init(a: AnyObject, b: AnyObject, color: String? = nil) {
        self.a = a
        self.b = b
        self.color = color
    }
}

/// A `ThreadLink` with its endpoints resolved to field positions — what the renderer draws.
public struct ThreadSegment {
    public var a: Vec3
    public var b: Vec3
    public var color: String?

    public init(a: Vec3, b: Vec3, color: String? = nil) {
        self.a = a
        self.b = b
        self.color = color
    }
}

// MARK: - Condition  (§5)

public typealias Condition = (_ body: Body, _ particle: Particle, _ env: Env?) -> Bool

// MARK: - Registries

public typealias ForceRegistry = [String: any Force]
public typealias ConditionRegistry = [String: Condition]
