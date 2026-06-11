import Foundation
import simd

// MARK: - Designed extended forces (§20.3, class [A]–[E]) — forces/extended.ts
//
// Like the canonical nine these are *designed* — finite range, soft falloff, tuned for
// legibility — but they live outside the core nine as opt-in enrichments. A body opts in
// via its tokens; a field that doesn't ask is unaffected.

/// §20.3 — `lens`: rotate the velocity, preserving its magnitude. A gravitational lens
/// bends a path without adding energy: θ = θ_max·(1 − d/d_max)·sign, then v ← rotate(v, θ).
public struct LensForce: Force {
    public let token = "lens"
    public let label = "Lens"
    public let isKinematic = true // a pure rotation of velocity — bends the path, not the speed
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let theta = b.strength * (1 - e.dist / b.range) * b.spin
        p.velocity = simd_quatf(angle: theta, axis: PLANE_AXIS).act(p.velocity)
    }
}

/// §20.3 — `gate`: a one-way membrane. Along its heading matter passes freely; matter
/// crossing the *wrong* way (v·n < 0) is reflected across the membrane: v −= 2(v·n)·n.
public struct GateForce: Force {
    public let token = "gate"
    public let label = "Gate"
    public let isKinematic = true // reflects wrong-way crossers — a constraint, not an acceleration
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let pad: Float = 6 // act on matter within the element box (the membrane's extent)
        let o = simd_abs(p.position - b.center)
        if o.x >= b.box.hw + pad || o.y >= b.box.hh + pad { return }
        let vn = simd_dot(p.velocity, b.heading) // velocity along the heading n
        if vn < 0 {
            p.velocity -= 2 * vn * b.heading // reflect the wrong-way crosser back through n
        }
    }
}

/// §20.3 — `buoyancy`: a constant lift/sink set by a density difference. A particle's
/// density ρ_p = base / (size·(1 + heat)) falls as it grows or heats, so hot/large matter
/// rises while denser matter settles. `strength` is g; range 0 makes it global.
/// The engine's +y points *down*, so the lift subtracts from v.y.
let BUOY_BASE: Float = 1
let BUOY_MEDIUM: Float = 1
public struct BuoyancyForce: Force {
    public let token = "buoyancy"
    public let label = "Buoyancy"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if b.range > 0 && e.dist >= b.range { return } // range 0 ⇒ global field
        let rhoP = BUOY_BASE / (p.size * (1 + p.heat)) // hotter / bigger → lighter
        p.velocity.y -= (BUOY_MEDIUM - rhoP) * b.strength // lift up (−y) when lighter
    }
}

/// §20.3 — `shear`: a laminar velocity gradient (Couette flow). Speed along the flow axis
/// grows with a particle's *perpendicular* offset from the body — laminae sliding past
/// each other. The heading sets the flow axis; `strength` is S.
public struct ShearForce: Force {
    public let token = "shear"
    public let label = "Shear"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        // perpendicular axis = plane-axis × heading; offset_⊥ = (p − centre) · perp
        let perp = simd_cross(PLANE_AXIS, b.heading)
        let offsetPerp = simd_dot(p.position - b.center, perp)
        let f = b.strength * (offsetPerp / b.range) * (1 - e.dist / b.range)
        p.velocity += b.heading * f // accelerate along the flow axis n
    }
}

/// §20.3 — `crystallize`: a phase change. While a particle is cool (heat < FREEZE) it
/// snaps toward the nearest node of a lattice anchored at the body, then damps so it
/// settles into a solid; once hot it melts and moves freely. Pairs with `data-when="cool"`.
let LATTICE: Float = 32  // lattice cell, px
let FREEZE: Float = 0.5  // heat below which matter solidifies
public struct CrystallizeForce: Force {
    public let token = "crystallize"
    public let label = "Crystallize"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range || p.heat >= FREEZE { return } // out of range or melted → free
        let nodeX = b.center.x + ((p.position.x - b.center.x) / LATTICE).rounded() * LATTICE
        let nodeY = b.center.y + ((p.position.y - b.center.y) / LATTICE).rounded() * LATTICE
        p.velocity.x += (nodeX - p.position.x) * b.strength // pull toward the lattice node
        p.velocity.y += (nodeY - p.position.y) * b.strength
        p.velocity.x *= 0.9 // damp → settle into the solid
        p.velocity.y *= 0.9
    }
}

/// §20.3 — `align`: steer velocity toward a target heading while preserving speed.
/// Uses the **mean of neighbours' headings** when any are in reach (boids alignment),
/// falling back to the body's own heading when alone. `strength` is k_align.
public struct AlignForce: Force {
    public let token = "align"
    public let label = "Align"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let speed = simd_length(p.velocity) // steer toward ĥ·|v| → turns without speeding up
        let k = b.strength
        var h = b.heading // [A] default: the body heading
        var s = Vec3.zero
        for n in e.neighbors(p, b.range) {
            let ns = simd_length(n.velocity) // sum the neighbours' unit velocities (v̂)
            if ns > 1e-6 { s += n.velocity / ns }
        }
        let sm = simd_length(s)
        if sm > 1e-6 { h = s / sm } // [B]: the mean neighbour heading
        p.velocity += (h * speed - p.velocity) * k
    }
}

/// A smooth divergence-free flow field (§20.3) — the curl of a sinusoidal stream-function
/// ψ = sin(a)·cos(b). Divergence-free by construction, so it stirs without compressing.
/// Closed-form (no RNG) → deterministic and exactly testable. Planar (z untouched).
public func curlNoise(x: Float, y: Float, t: Float, s: Float) -> Vec3 {
    let a = x * s + t * 0.2
    let b = y * s - t * 0.2
    // ∂ψ/∂x = s·cos(a)cos(b), ∂ψ/∂y = −s·sin(a)sin(b); curl = (∂ψ/∂y, −∂ψ/∂x)
    return Vec3(-s * sin(a) * sin(b), -s * cos(a) * cos(b), 0)
}

/// §20.3 — `wind`: divergence-free turbulence, v += curl(noise)·S. Range 0 = a global gust.
let WIND_SCALE: Float = 0.01
public struct WindForce: Force {
    public let token = "wind"
    public let label = "Wind"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if b.range > 0 && e.dist >= b.range { return } // range 0 ⇒ global
        p.velocity += curlNoise(x: p.position.x, y: p.position.y, t: e.t, s: WIND_SCALE) * b.strength
    }
}

/// §20.3 — `cohesion` (class [B]): short-range pressure + mid-range pull — surface
/// tension. Around a rest distance r₀ each neighbour pushes p away when closer than r₀
/// and draws it in between r₀ and the neighbour radius r₁. r₀ = r₁·0.5; range is r₁.
let COHESION_REST: Float = 0.5 // r₀ as a fraction of r₁
public struct CohesionForce: Force {
    public let token = "cohesion"
    public let label = "Cohesion"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let r1 = b.range
        let r0 = r1 * COHESION_REST
        let k = b.strength
        for n in e.neighbors(p, r1) {
            let d3 = n.position - p.position
            let dn = simd_length(d3)
            if dn < 1e-6 { continue }
            let u = d3 / dn
            if dn < r0 {
                p.velocity -= u * (k * (r0 - dn) / r0) // pressure: push apart (no overlap)
            } else {
                p.velocity += u * (k * (dn - r0) / (r1 - r0)) // cohesion: pull toward the skin
            }
        }
    }
}

/// §20.3 — `pressure` (class [B]): SPH-style density relaxation → an incompressible
/// even-fill. Estimates local density with the kernel W = (1 − d/h)², then pushes *down*
/// the density gradient whenever above the rest density ρ₀ — crowded matter spreads out.
let PRESSURE_REST: Float = 0.5 // ρ₀ — the rest density that sets the equilibrium spacing
public struct PressureForce: Force {
    public let token = "pressure"
    public let label = "Pressure"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let h = b.range
        let k = b.strength
        // first pass: local density ρ_p = Σ W(d, h)
        var rho: Float = 0
        let ns = e.neighbors(p, h)
        for n in ns {
            let d = simd_length(n.position - p.position)
            if d < h { rho += pow(1 - d / h, 2) }
        }
        let over = rho - PRESSURE_REST // pressure scalar P = k·(ρ − ρ₀)
        if over <= 0 { return } // under-dense → no push
        // second pass: push away from each neighbour along the density gradient
        for n in ns {
            let d3 = p.position - n.position // neighbour → p, the away-from-crowd direction
            let d = simd_length(d3)
            if d < 1e-6 || d >= h { continue }
            p.velocity += d3 * (k * over * (1 - d / h) / d)
        }
    }
}

/// §20.3 — `hunt` (class [B]): a two-species pursuit. Predators (species 0) accelerate
/// toward the nearest particle of another species; prey accelerate directly away.
public struct HuntForce: Force {
    public let token = "hunt"
    public let label = "Hunt"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let me = p.species ?? 0
        // the nearest neighbour of a *different* species — the target to chase or escape
        var target: Particle? = nil
        var bestD2 = Float.infinity
        for n in e.neighbors(p, b.range) {
            if (n.species ?? 0) == me { continue }
            let d2 = simd_length_squared(n.position - p.position)
            if d2 < bestD2 {
                bestD2 = d2
                target = n
            }
        }
        guard let target else { return } // nothing of the other species in reach
        let d3 = target.position - p.position
        let d = max(simd_length(d3), 1)
        let dir: Float = me == 0 ? 1 : -1 // predator seeks (toward), prey flees (away)
        p.velocity += (d3 / d) * (b.strength * dir)
    }
}

/// §20.3 — `link` (class [B]): a Verlet distance constraint that holds matter at a rest
/// length, so a dense blob behaves as rope/chain/cloth. Bonds to every neighbour inside
/// the bond radius; each particle applies *half* the correction (the partner does its
/// half on its own turn) — symmetric, momentum-conserving.
let LINK_REST: Float = 0.35 // rest length L as a fraction of the bond radius (range)
public struct LinkForce: Force {
    public let token = "link"
    public let label = "Link"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if e.dist >= b.range { return }
        let r = b.range
        let L = r * LINK_REST
        let k = b.strength
        for n in e.neighbors(p, r) {
            let d3 = n.position - p.position
            let d = simd_length(d3)
            if d < 1e-6 { continue }
            let err = d - L // +ve → too far (pull together); −ve → too close (push apart)
            p.velocity += (d3 / d) * (0.5 * k * (err / L))
        }
    }
}

/// §20.3 — `morph` (class [D]): matter assembles into a shape. Each particle gets a
/// stable target from the body's `targets` (hashed from its fixed scatter fraction gx,
/// so the assignment never flickers), springs toward it, and the jitter fades on arrival.
///
/// **DESIGN LAW (§11):** targets are *marks* — a logo, an icon, a chart, a map —
/// **never words or letterforms**. Text is rendered as text and made to react.
let MORPH_ARRIVE: Float = 40 // px within which a particle counts as "arrived"
public struct MorphForce: Force {
    public let token = "morph"
    public let label = "Morph"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        guard let ts = b.targets, !ts.isEmpty else { return } // no shape assigned → inert
        // stable assignment: hash the particle's fixed scatter fraction to a target index
        let i = min(ts.count - 1, Int(p.gx * Float(ts.count)))
        let t = ts[i]
        let d3 = t - p.position
        let d = simd_length(d3)
        let k = b.strength
        p.velocity += d3 * (k * 0.02) // spring toward the target point
        let arrived: Float = d < MORPH_ARRIVE ? 1 - d / MORPH_ARRIVE : 0
        let jit = (1 - arrived) * k * 0.3 // jitter that fades to zero on arrival
        if jit > 0 {
            p.velocity.x += (Float.random(in: 0..<1) - 0.5) * jit
            p.velocity.y += (Float.random(in: 0..<1) - 0.5) * jit
        }
    }
}

/// §20.1/§20.2 — `spawn` (class [S], the source atom): the one force that *creates*
/// matter. While its body is engaged it emits mortal particles at the body centre along
/// the heading within a soft cone, budgeted by `life` (default 90 frames) and `sourceCap`
/// (clamping the rate to cap/life with a fractional accumulator).
public let SPAWN_LIFE: Float = 90
public struct SpawnForce: Force {
    public let token = "spawn"
    public let label = "Spawn"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {} // a source — work in source()

    public func source(body b: Body, env e: Env) {
        let life = b.life ?? SPAWN_LIFE
        var rate = Swift.max(Float(1), (b.strength * 2).rounded()) // particles per frame
        if let cap = b.sourceCap, cap > 0, life > 0 {
            rate = Swift.min(rate, Float(cap) / life)
        }
        b.emitAcc = (b.emitAcc ?? 0) + rate
        var n = Int((b.emitAcc ?? 0).rounded(.down))
        b.emitAcc! -= Float(n)
        while n > 0 {
            n -= 1
            // rotate the heading by a small random angle → a soft emission cone
            let j = (Float.random(in: 0..<1) - 0.5) * 0.6
            let h = simd_quatf(angle: j, axis: PLANE_AXIS).act(b.heading)
            let speed = 2 + Float.random(in: 0..<1) * 2
            let p = Particle(position: b.center, velocity: h * speed, heat: 0.6)
            p.age = life
            e.spawn(p)
        }
    }
}

/// §20.3 — `resonate`: a *modifier* that pulses its sibling forces with the time-varying
/// strength multiplier 1 + sin(ω·t) — `resonate attract` is a well that breathes.
let RESONATE_OMEGA: Float = 3
public struct ResonateForce: Force {
    public let token = "resonate"
    public let label = "Resonate"
    public let hasModify = true
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {} // pure modifier

    public func modify(body b: Body, particle p: Particle, env e: Env) -> ForceModification? {
        ForceModification(strength: 1 + sin(e.t * RESONATE_OMEGA * b.spin))
    }
}

/// §20.3 — `spotlight`: a *modifier* that gates its sibling forces to an angular cone of
/// the heading. Outside the cone every token on the body is skipped this frame; inside,
/// the siblings act normally — `spotlight stream` is a directed beam. Half-angle ~60°.
let SPOTLIGHT_COS: Float = 0.5
public struct SpotlightForce: Force {
    public let token = "spotlight"
    public let label = "Spotlight"
    public let hasModify = true
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {} // pure modifier

    public func modify(body b: Body, particle p: Particle, env e: Env) -> ForceModification? {
        let dir = -e.vector / e.dist // body → particle (env.vector points particle → body)
        return ForceModification(gate: simd_dot(dir, b.heading) < SPOTLIGHT_COS)
    }
}

/// Workover v0.3 — `screen`: a quiet zone / shield. A body carrying `screen` damps the
/// magnitude of OTHER bodies' forces on matter inside its range, by `screenFactor`.
/// Cross-body by definition, so the work lives in the integrator's force pass; this is
/// the registered token and identity. `apply` is a no-op.
public struct ScreenForce: Force {
    public let token = "screen"
    public let label = "Screen"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {} // attenuation in the integrator
}

/// §20.8 — `pigment` (class [E]): conserved color transport. A particle that overlaps a
/// pigment body takes on the body's tint and carries it away — the color advects with
/// the matter instead of being re-tinted globally.
public struct PigmentForce: Force {
    public let token = "pigment"
    public let label = "Pigment"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        guard let tint = b.tint, e.dist < b.range * 0.6 else { return } // only stains on overlap
        p.color = p.color.map { mixHex($0, tint, t: 0.08) } ?? tint // adopt, then advect toward
    }
}

/// §20.3 — `fieldflow`: follow the field lines. Advects ALL matter ALONG the net
/// structure field every body radiates (the superposition of every field() hook, read
/// through env.fieldAt): **steers** velocity onto the local line (speed-preserving) and
/// **streams** matter down it (does work). Direction is used scale-free (normalized), so
/// a weak dipole channels matter as surely as a strong monopole. Range 0 ⇒ global.
let FIELDFLOW_STEER: Float = 0.5  // fraction of velocity turned onto the line per frame (× gain)
let FIELDFLOW_ACCEL: Float = 0.12 // streaming acceleration along the line (× gain)
public struct FieldFlowForce: Force {
    public let token = "fieldflow"
    public let label = "Field Flow"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if b.range > 0 && e.dist >= b.range { return } // range 0 ⇒ global
        guard let F = e.fieldAt?(p.position) else { return }
        let mag = simd_length(F)
        guard mag > 1e-9 else { return } // a true null point (or NaN) — no line to follow
        let u = F / mag // the field-line tangent (direction only — scale-free)
        let falloff: Float = b.range > 0 ? 1 - e.dist / b.range : 1
        let gain = b.strength * falloff
        // 1) STEER onto the line — turn velocity toward the tangent without spending it.
        let sp = simd_length(p.velocity)
        if sp > 1e-6 {
            let k = Swift.min(1, gain * FIELDFLOW_STEER)
            p.velocity += (u * sp - p.velocity) * k
        }
        // 2) STREAM down the line — accelerate along it (the flare ejection; does work).
        p.velocity += u * (gain * FIELDFLOW_ACCEL)
        clampToC(p, e.c) // bound by the unit system's speed of light (§20.10)
        if b.isEngaged { p.heat = Swift.max(p.heat, falloff * 0.4) }
    }
}

/// §22.3 — `warp`: a wormhole throat. Matter that enters the throat (within absorbR) is
/// *relocated* — conserved, not created or destroyed — to the paired body's throat,
/// emerging just outside it moving outward, with its local offset and velocity rotated
/// by `twist` and scaled by `warpScale`. The engine resolves the pairing into
/// `warpHas`/`warpTarget`; the force no-ops with no resolved target. Kinematic: a teleport.
public struct WarpForce: Force {
    public let token = "warp"
    public let label = "Warp"
    public let isKinematic = true
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if !b.warpHas || p.cap != nil { return }
        let throat = b.absorbR
        if e.dist >= throat { return }
        guard let target = b.warpTarget else { return }
        let rot = simd_quatf(angle: b.twist ?? 0, axis: PLANE_AXIS)
        let k = b.warpScale ?? 1
        // entry direction (unit local offset from this throat), twisted
        let u = -e.vector / e.dist
        let ru = rot.act(u)
        // emerge just outside the paired throat so it does not immediately re-enter
        let outR = throat * k + 6
        p.position = target + ru * outR
        // carry momentum through, rotated by the same twist (speed conserved)
        p.velocity = rot.act(p.velocity)
        p.heat = Swift.max(p.heat, 0.6)
    }
}

/// The designed extended forces, in spec order (§20.3).
public func extendedForces() -> [any Force] {
    [LensForce(), GateForce(), BuoyancyForce(), ShearForce(), CrystallizeForce(),
     AlignForce(), WindForce(), CohesionForce(), PressureForce(), LinkForce(),
     HuntForce(), MorphForce(), SpawnForce(), ResonateForce(), SpotlightForce(),
     ScreenForce(), PigmentForce(), FieldFlowForce(), WarpForce()]
}
