import Foundation
import simd

// MARK: - Natural primitives (§20.10)
//
// Real field laws, not the designed UI falloffs. The canonical nine are *designed*: finite
// range, soft (1 − d/d_max)ⁿ falloff. These are *natural*: a true softened inverse-square
// law in the sim unit system. `gravity` and `charge` are the same kernel — only the source
// scalar differs (mass ≥ 0 vs. signed charge).
//
// Opt-in: a body only feels them via the "gravity"/"charge" tokens, so registering them
// changes nothing in a field that doesn't ask for them.

/// Chargeable bodies (Stage C2): accumulated charge Q = b.d (the eased density) amplifies
/// the radiated field — as the element charges up, it radiates up to (1 + Q_GAIN)× its base.
let Q_GAIN: Float = 1.5
let DIPOLE_MIN_SEP: Float = 8    // below this the box gives no usable dipole axis
let DIPOLE_MIN_REACH: Float = 60 // synthesized pole reach floor (covers range-0 / point bodies)

/// The body's dipole field at a world point (the visual/structure field, Stage B): the
/// two-pole superposition scaled by the source magnitude `s`. Shared by `magnetism` (the
/// bar magnet, rendered but not followed) and `charge`'s dipole rendering.
func bodyDipole(_ b: Body, at point: Vec3, s: Float) -> Vec3 {
    var (a, c) = polePair(AxisBox(box: b.box, heading: b.heading, spin: b.spin))
    let sep = simd_length(a.position - c.position)
    // synthesize when the box gives no usable separation — every magnetism/charge source
    // then reads as a dipole regardless of size. Pixel floors cover range-0/global bodies.
    if sep < max(b.range * 0.06, DIPOLE_MIN_SEP) {
        let half = max(b.range * 0.18, DIPOLE_MIN_REACH)
        let sgn: Float = b.spin < 0 ? -1 : 1
        a = Pole(position: b.center + b.heading * half, charge: sgn)
        c = Pole(position: b.center - b.heading * half, charge: -sgn)
    }
    let sq = s * (1 + Q_GAIN * b.d) // charged elements radiate a stronger field
    return dipoleField(poles: [a, c], at: point) * sq
}

/// The radial monopole field of a single point charge (the electric field, §20.3):
/// straight field lines out of a positive source, into a negative one.
func bodyMonopole(_ b: Body, at point: Vec3, s: Float) -> Vec3 {
    let d3 = point - b.center
    let d = max(simd_length(d3), EPS)
    let sgn: Float = b.spin < 0 ? -1 : 1
    let mag = (sgn * s * (1 + Q_GAIN * b.d)) / (d * d) // 1/d², signed by polarity
    return (d3 / d) * mag
}

/// The radial gravitational field at a world point (Stage B) — always toward the mass.
func bodyGravityField(_ b: Body, at point: Vec3) -> Vec3 {
    let d3 = b.center - point // toward the body — gravity attracts
    let d = max(simd_length(d3), EPS)
    let mag = (b.M * (1 + Q_GAIN * b.d)) / (d * d)
    return (d3 / d) * mag
}

/// The shared softened inverse-square kernel (§20.10): `s / (d² + ε²)` along the unit
/// vector toward the body, then clamp speed to the unit system's `c`.
///
/// Plummer softening ε = r_s = 2GM/c² keeps the force finite at the core while staying a
/// true 1/d² law far out. `s` is the signed source strength: +GM for gravity (always
/// attractive), −σ·q·GM for charge (like repels, opposite attracts).
public func inverseSquare(_ b: Body, _ p: Particle, _ e: Env, s: Float) {
    if e.dist >= b.range { return } // practical cutoff radius (an N-body softening too)
    let rs = (2 * e.G * b.M) / (e.c * e.c) // Schwarzschild radius → softening ε
    let f = s / (e.dist * e.dist + rs * rs)
    p.velocity += (e.vector / e.dist) * f
    clampToC(p, e.c)
}

/// Clamp a particle's speed to the unit system's `c` — the hard velocity cap that IS the
/// in-sim speed of light (§20.10). Shared by the natural primitives.
@inline(__always)
func clampToC(_ p: Particle, _ c: Float) {
    let sp = simd_length(p.velocity)
    if sp > c { p.velocity *= c / sp }
}

/// §20.10 — true softened inverse-square: F = GM·d̂/(d²+ε²), always attractive.
public struct GravityForce: Force {
    public let token = "gravity"
    public let label = "Gravity"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        inverseSquare(b, p, e, s: e.G * b.M) // GM, mass-sourced (M ≥ 0 → pulls in)
    }

    /// The inward radial gravitational field (Stage B): renderable structure `fieldflow`
    /// can follow. `apply` is unchanged — a field line is not always a particle path.
    public func field(body b: Body, at point: Vec3) -> Vec3? {
        bodyGravityField(b, at: point)
    }
}

/// §20.3/§20.10 — the signed sibling of gravity; same kernel, sign sets direction.
public struct ChargeForce: Force {
    public let token = "charge"
    public let label = "Charge"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let q = p.charge ?? 0 // neutral matter ignores charge fields
        if q == 0 { return }
        // F = σ·q·GM/(d²+ε²); negated for the inward-pointing kernel so like signs repel.
        inverseSquare(b, p, e, s: -(b.spin * q * e.G * b.M))
    }

    /// The radial electric field (Stage B): straight lines, OUT of a + source, IN to a −.
    /// A lone charge is a monopole (unlike a magnet's dipole).
    public func field(body b: Body, at point: Vec3) -> Vec3? {
        bodyMonopole(b, at: point, s: b.M)
    }
}

/// §20.10 — the Lorentz force on a moving charge: curves a particle's path **without doing
/// work** — speed is preserved, only the heading turns. `spin` sets the field's sense,
/// `strength` is |B|, graded by a (1 − d/r) falloff so the curl eases to zero at the rim.
///
/// Implemented as an exact rotation about the field axis by θ = q·spin·B·falloff per frame
/// — preserves |v| to floating-point precision (the Euler form accumulates speed). In 3D
/// the axis is the plane normal; a volumetric B along the body's heading is a one-line swap.
public struct MagnetismForce: Force {
    public let token = "magnetism"
    public let label = "Magnetism"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return } // inside the field region
        let q = p.charge ?? 0
        if q == 0 { return } // the Lorentz force needs charge
        let falloff = 1 - e.dist / b.range // ∈ (0, 1] inside the region
        let theta = q * b.spin * b.strength * falloff
        p.velocity = simd_quatf(angle: theta, axis: PLANE_AXIS).act(p.velocity)
    }

    /// The dipole structure of B (Stage B). Rendered as field lines; particles curve
    /// perpendicular to it rather than following it.
    public func field(body b: Body, at point: Vec3) -> Vec3? {
        bodyDipole(b, at: point, s: b.strength)
    }
}

/// The Langevin noise amplitude σ = √(2·k_B·T·γ) (§20.10). In sim units k_B = γ = 1, so
/// σ = √(2T); negative T is floored to 0 (no imaginary kicks).
public func thermalSigma(_ T: Float) -> Float {
    sqrt(2 * max(0, T))
}

/// §20.10 — `thermal`: Langevin/Brownian agitation, the *honest* wander. Each frame a
/// charge-free Gaussian kick v += σ·ξ jiggles matter, with σ = √(2T). Paired with drag
/// it's a thermostat — fluctuation–dissipation, the swarm equilibrates at temperature T.
/// Box–Muller turns two uniforms into one isotropic kick (gaining a z component in a
/// volumetric field).
public struct ThermalForce: Force {
    public let token = "thermal"
    public let label = "Thermal"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let falloff = 1 - e.dist / b.range // localized: hotter nearer the source
        let sigma = thermalSigma(b.strength * falloff)
        if sigma == 0 { return }
        // Box–Muller: (u1, u2) → one isotropic N(0,1) pair, scaled by σ.
        let u1 = max(Float.random(in: 0..<1), 1e-9) // avoid log(0)
        let mag = sigma * sqrt(-2 * log(u1))
        let ang = 2 * Float.pi * Float.random(in: 0..<1)
        p.velocity.x += mag * cos(ang)
        p.velocity.y += mag * sin(ang)
        if e.volume.z > 0 {
            let u2 = max(Float.random(in: 0..<1), 1e-9)
            p.velocity.z += sigma * sqrt(-2 * log(u2)) * cos(2 * Float.pi * Float.random(in: 0..<1))
        }
        if b.isEngaged { p.heat = max(p.heat, falloff * 0.4) }
        clampToC(p, e.c)
    }
}

/// §20.10 — `collide`: elastic pairwise collision (granular / billiard). For each
/// neighbour whose sphere overlaps and that is *approaching*, the pair exchanges normal
/// momentum symmetrically in one pass — momentum-conserving and order-independent.
/// `strength` is the restitution e ∈ [0,1]. Class [B] — uses env.neighbors.
public struct CollideForce: Force {
    public let token = "collide"
    public let label = "Collide"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return } // collisions resolve within the body's region
        let restitution = clamp(b.strength, 0, 1)
        let pr = max(1, p.size)
        for q in e.neighbors(p, pr * 4) {
            let qr = max(1, q.size)
            let n = p.position - q.position
            let d = simd_length(n)
            if d >= pr + qr || d < 1e-6 { continue } // not in contact
            let u = n / d
            let relN = simd_dot(p.velocity - q.velocity, u)
            if relN >= 0 { continue } // separating already → no impulse
            // equal-and-opposite half-impulses so the pass is symmetric; after this the
            // pair is separating, so q's own apply skips it.
            let j = (1 + restitution) * 0.5 * relN
            p.velocity -= u * j
            q.velocity += u * j
        }
    }
}

/// §20.10 — `diffuse` (class [C], over the scalar `grid`): the pheromone/stigmergy
/// field. Each frame a particle lays a mark into the shared `diffuse` grid (which the
/// engine blurs via ∂φ/∂t = D∇²φ) and steers *up* the local gradient, following the
/// smeared trail toward where matter has gathered. `strength` sets both the deposit and
/// the follow gain. Self-organizing trails emerge from the deposit↔blur↔follow loop.
public struct DiffuseForce: Force {
    public let token = "diffuse"
    public let label = "Diffuse"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let g = e.grid("diffuse")
        g.deposit(at: p.position, amount: b.strength) // lay a mark
        let grad = g.gradient(at: p.position) // follow the blurred trail up-gradient
        p.velocity += grad * b.strength
    }
}

/// Frames between emitted shocks while a propagate body is engaged. A *pulse train* — not
/// a continuous drip — is what keeps it a travelling wave: between pulses the grid
/// radiates and damps, so no standing bump builds at the source.
let WAVE_PULSE_PERIOD = 12
/// How hard a passing wavefront carries matter outward (radiation pressure gain).
let WAVE_PUSH: Float = 7

/// §20.10 — `propagate` (class [C], over a wave-mode `grid`): a travelling disturbance,
/// ∂²φ/∂t² = c²∇²φ. An engaged body injects an impulsive shock at its centre (via the
/// body-level `source` hook, once per frame), and the grid carries it outward as a real
/// expanding ring. Matter **rides the front out** — radiation pressure, not an inward pull.
public struct PropagateForce: Force {
    public let token = "propagate"
    public let label = "Propagate"
    public init() {}

    public func source(body b: Body, env e: Env) {
        if !b.isEngaged { return } // only an engaged body emits
        if e.frameN % WAVE_PULSE_PERIOD != 0 { return } // a shock train, once per period
        e.grid("wave-propagate").deposit(at: b.center, amount: b.strength) // 'wave…' → wave stepping
    }

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let g = e.grid("wave-propagate")
        let grad = g.gradient(at: p.position)
        let act = simd_length(grad) // wavefront activity — steep where a front is passing
        if act < 1e-6 { return } // no front here → coast
        // ride the front: pushed radially OUTWARD (env.vector points toward the body, so negate).
        let u = -e.vector / e.dist
        p.velocity += u * (act * b.strength * WAVE_PUSH)
        clampToC(p, e.c)
    }
}

/// Memory (class [C], over a slow-decaying `memory` grid) — the field remembers.
/// Each frame a particle lays occupancy where it sits, into a grid that barely blurs and
/// fades slowly; the body's pull is then amplified by how worn the spot is: M(x) += λ and
/// the effective force ×= (1 + μ·M) — frequently-travelled routes deepen and pull harder.
public struct MemoryForce: Force {
    public let token = "memory"
    public let label = "Memory"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let g = e.grid("memory") // 'memory' name → slow-decay stepping
        g.deposit(at: p.position, amount: b.strength * 0.15) // wear the path where matter sits
        let amp = 1 + 0.5 * g.sample(at: p.position) // worn paths pull harder (1 + μ·M)
        let f = pow(1 - e.dist / b.range, 2) * b.strength * 0.5 * amp
        p.velocity += (e.vector / e.dist) * f
    }
}

/// The natural primitives, in spec order (§20.10).
public func naturalForces() -> [any Force] {
    [GravityForce(), ChargeForce(), MagnetismForce(), ThermalForce(), CollideForce(),
     DiffuseForce(), PropagateForce(), MemoryForce()]
}
