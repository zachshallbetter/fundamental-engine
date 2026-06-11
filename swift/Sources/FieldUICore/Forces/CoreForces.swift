import Foundation
import simd

// MARK: - The canonical nine forces (§6)
//
// Each is an independent `Force` — the engine never changes to add one (§4). The math is
// the exact per-frame implementation from forces-system.md §6.1–§6.9, lifted to 3D:
// `env.vector` points from the particle toward the body; `env.dist ≥ 1`. Tangential terms
// use cross products against the plane axis (0,0,1) — identical to the JS 2D math at z=0,
// meaningful swirl-about-axis in a volume. On-state (`isEngaged`) widens range and boosts
// strength per the spec.

/// The out-of-plane axis 2D tangential math is defined against.
@usableFromInline let PLANE_AXIS = Vec3(0, 0, 1)

/// §6.1 — a soft gravity-like well, with optional orbital swirl.
public struct AttractForce: Force {
    public let token = "attract"
    public let label = "Attract"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.5 : 1)
        let s = b.strength * (b.isEngaged ? 3 : 1)
        if e.dist >= range { return }
        let f = pow(1 - e.dist / range, 2) * s * 0.5
        let u = e.vector / e.dist
        p.velocity += u * f
        if e.form.orbit != 0 {
            p.velocity += simd_cross(PLANE_AXIS, u) * (f * e.form.orbit) // tangential swirl → orbits
        }
        if b.isEngaged { p.heat = max(p.heat, (1 - e.dist / range) * 0.9) }
    }
}

/// §6.6 — inverse-square outward push; carves a void.
public struct RepelForce: Force {
    public let token = "repel"
    public let label = "Repel"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.4 : 1)
        let s = b.strength * (b.isEngaged ? 2 : 1)
        if e.dist >= range { return }
        let f = pow(1 - e.dist / range, 2) * s * 0.5
        p.velocity -= (e.vector / e.dist) * f
    }
}

/// §6.8 — tangential swirl with light inward retention.
public struct SwirlForce: Force {
    public let token = "swirl"
    public let label = "Swirl"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.4 : 1)
        let s = b.strength * (b.isEngaged ? 2 : 1)
        if e.dist >= range { return }
        let f = pow(1 - e.dist / range, 1.4) * s * 0.45
        let u = e.vector / e.dist
        // tangential swirl with a light inward retention (0.12): the swirl dominates ~8×,
        // so canonical swirl reads as a designed spin, not a drain.
        p.velocity += simd_cross(u, PLANE_AXIS) * (f * b.spin) + u * (f * 0.12)
        if b.isEngaged { p.heat = max(p.heat, (1 - e.dist / range) * 0.6) }
    }
}

/// §6.5 — a steady directional current along the heading.
public struct StreamForce: Force {
    public let token = "stream"
    public let label = "Stream"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.4 : 1)
        let s = b.strength * (b.isEngaged ? 2 : 1)
        if e.dist >= range { return }
        let f = pow(1 - e.dist / range, 1.1) * s * 0.5
        p.velocity += b.heading * f
        if b.isEngaged { p.heat = max(p.heat, (1 - e.dist / range) * 0.5) }
    }
}

/// §6.7 — viscosity; bleeds momentum, no redirection.
public struct ViscosityForce: Force {
    public let token = "viscosity"
    public let label = "Viscosity"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.4 : 1)
        if e.dist >= range { return }
        let k = (1 - e.dist / range) * (0.05 + b.strength * 0.07) * (b.isEngaged ? 1.6 : 1)
        p.velocity -= p.velocity * k
    }
}

/// §6.2 — a conduit: draws matter in, jets it out along the heading.
public struct JetForce: Force {
    public let token = "jet"
    public let label = "Jet"
    public let isKinematic = true // relaunches matter at the nozzle, so mass must not scale it
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let range = b.range * (b.isEngaged ? 1.4 : 1)
        if e.dist >= range { return }
        if e.dist < 24 {
            // at the nozzle: relaunch as a hot jet, with a cone of spread (about the plane axis).
            let sp = (Float.random(in: 0..<1) - 0.5) * 0.8
            let rot = simd_quatf(angle: sp, axis: PLANE_AXIS)
            let h = rot.act(b.heading)
            let spd = 2.4 + b.strength * 2.6
            p.velocity = h * spd
            p.position = b.center + h * 26
            p.heat = max(p.heat, 0.9)
        } else {
            // feed: draw surrounding matter toward the nozzle.
            let f = pow(1 - e.dist / range, 2) * (0.25 + b.strength * 0.15)
            p.velocity += (e.vector / e.dist) * f
        }
    }
}

/// §6.3 — a tether with a rest length; holds matter at a shell radius.
public struct TetherForce: Force {
    public let token = "tether"
    public let label = "Tether"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let rest = b.range * 0.6 * (b.isEngaged ? 1.25 : 1)
        let reach = rest * 2.1
        if e.dist >= reach { return }
        let k = (0.006 + b.strength * 0.012) * (b.isEngaged ? 1.7 : 1)
        let stretch = e.dist - rest
        p.velocity += (e.vector / e.dist) * (stretch * k)
        p.velocity *= 0.985
        if b.isEngaged {
            p.heat = max(p.heat, (1 - min(1, abs(stretch) / rest)) * 0.5)
        }
    }
}

/// §6.4 — an axis-aligned bouncing box; sparks on hard impact.
/// In 3D the reflection axis is the one of least penetration; a flat box (hd = 0)
/// only ever reflects x or y — exactly the JS wall.
public struct WallForce: Force {
    public let token = "wall"
    public let label = "Wall"
    public let isKinematic = true // an elastic bounce reflects velocity regardless of inertia
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        let pad: Float = 6
        let o = simd_abs(p.position - b.center)
        let he = b.box.halfExtents
        if o.x >= he.x + pad || o.y >= he.y + pad { return }
        let solid3D = he.z > 0
        if solid3D && o.z >= he.z + pad { return }
        let speed = simd_length(p.velocity)
        let px = he.x + pad - o.x
        let py = he.y + pad - o.y
        let pz = solid3D ? he.z + pad - o.z : Float.infinity
        if px < py && px < pz {
            p.position.x = p.position.x < b.center.x ? b.center.x - he.x - pad : b.center.x + he.x + pad
            p.velocity.x = -p.velocity.x * 0.85
        } else if py < pz {
            p.position.y = p.position.y < b.center.y ? b.center.y - he.y - pad : b.center.y + he.y + pad
            p.velocity.y = -p.velocity.y * 0.85
        } else {
            p.position.z = p.position.z < b.center.z ? b.center.z - he.z - pad : b.center.z + he.z + pad
            p.velocity.z = -p.velocity.z * 0.85
        }
        if speed > 0.7 {
            e.spark(p.position, min(2.4, speed), CANONICAL_FORCE_COLORS["wall"]) // canon spark tint (forces.config)
            p.heat = max(p.heat, min(0.85, speed * 0.4))
        }
    }
}

/// §6.9 — captures matter (held, conserved), then releases on saturation.
public struct SinkForce: Force {
    public let token = "sink"
    public let label = "Sink"
    public init() {}

    public func apply(body b: Body, particle p: Particle, env e: Env) {
        if p.cap != nil || e.dist >= b.absorbR { return }
        p.cap = b
        b.accreted += 1
        if b.accreted >= b.capacity { e.supernova(b) }
    }
}

/// The canonical nine, in spec order.
public func coreForces() -> [any Force] {
    [AttractForce(), JetForce(), TetherForce(), WallForce(), StreamForce(),
     RepelForce(), ViscosityForce(), SwirlForce(), SinkForce()]
}
