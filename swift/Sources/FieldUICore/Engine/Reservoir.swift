import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - The bound↔free reservoir (reservoir.ts, §2.4)
//
// The conserved exchange between the calm matter riding the Currents (bound) and the
// roaming matter (free). Wave-healing reclaims calm free particles onto the lines (up to
// boundTarget, so the lines never vacuum the open field); tearing rips bound matter
// loose with an outward kick. Count is conserved throughout.

/// Reclaim calm free matter onto the nearest line, up to `boundTarget` (§2.4).
public func healWaves(
    store: FieldStore,
    bound: inout [BoundParticle],
    boundTarget: Int,
    waves: [Wave],
    W: Float, H: Float,
    time: Float,
    rand: () -> Float
) {
    if waves.isEmpty { return }
    for p in store.particles.reversed() {
        if bound.count >= boundTarget { break }
        if p.cap != nil || p.heat >= 0.12 { continue }

        // nearest wave line
        var nwi = -1
        var nwd: Float = 1e9
        var nwy: Float = 0
        for (wi, w) in waves.enumerated() {
            let wy = waveYat(w, x: p.position.x, time: time, H: H)
            let dd = abs(wy - p.position.y)
            if dd < nwd {
                nwd = dd
                nwi = wi
                nwy = wy
            }
        }
        if nwi < 0 || nwd >= 64 { continue }

        // drift toward the line; snap home when very close, calm, and (rarely) lucky.
        let pull = min(0.012, nwd * 0.0004) * (1 - p.heat / 0.12)
        p.velocity.y += nwy > p.position.y ? pull : -pull
        if nwd < 20 && simd_length_squared(p.velocity) < 0.3 && rand() < 0.03 {
            bound.append(BoundParticle(
                wi: nwi,
                progress: p.position.x / W,
                phase: (rand() - 0.5) * 0.22 * .pi,
                size: p.size,
                glow: rand() < 0.3,
                speed: (0.00035 + rand() * 0.0009) * (rand() < 0.5 ? 1 : -1)
            ))
            store.remove(p)
        }
    }
}

/// Tear bound matter within `radius` of a point loose into the free pool (§6.9).
public func tearBoundNear(
    bound: inout [BoundParticle],
    waves: [Wave],
    center: Vec3,
    radius: Float,
    W: Float, H: Float,
    time: Float,
    spawn: (Particle) -> Void
) {
    var i = bound.count - 1
    while i >= 0 {
        defer { i -= 1 }
        let p = bound[i]
        guard waves.indices.contains(p.wi) else { continue }
        let w = waves[p.wi]
        let x = p.progress * W
        let y = waveYat(w, x: x, time: time, H: H) + p.phase * 32
        let d3 = Vec3(x, y, 0) - center
        let d = simd_length(d3)
        if d < radius && d > 0.5 {
            let f = (1 - d / radius) * 4
            let np = Particle(position: Vec3(x, y, 0), velocity: (d3 / d) * f, heat: 0.9, size: p.size)
            spawn(np)
            let last = bound.removeLast()
            if i < bound.count { bound[i] = last }
        }
    }
}

/// Force-tearing (§2.4): any force reaching a bound particle tears it loose into the
/// free pool with a kick, so it then *feels* the force. Selective gates act on free
/// matter only, so only always/active bodies tear bound.
public func tearBoundByForces(
    bound: inout [BoundParticle],
    waves: [Wave],
    bodies: [Body],
    forces: ForceRegistry,
    W: Float, H: Float,
    time: Float,
    spawn: (Particle) -> Void
) {
    // a body "exerts force" if it carries any non-modifier, non-source token. Modifiers
    // (resonate/spotlight) and pure sources (spawn) never tear bound particles.
    // "Pure source" = a force whose work is in source() (its apply is a no-op): spawn.
    func exertsForce(_ b: Body) -> Bool {
        b.tokens.contains { tok in
            guard let f = forces[tok] else { return false }
            return !f.hasModify && tok != "spawn" && tok != "propagate" && tok != "screen"
        }
    }

    var i = bound.count - 1
    while i >= 0 {
        defer { i -= 1 }
        let p = bound[i]
        guard waves.indices.contains(p.wi) else { continue }
        let w = waves[p.wi]
        let x = p.progress * W
        let y = waveYat(w, x: x, time: time, H: H) + p.phase * 32

        var hit = false
        var kick = Vec3.zero
        for b in bodies {
            if !b.isVisible { continue }
            if b.when == "active" && !b.isEngaged { continue }
            if !b.when.isEmpty && b.when != "active" { continue } // selective → free agents only
            let toks = b.tokens
            let d3 = b.center - Vec3(x, y, 0)
            let dist = max(simd_length(d3), 1)
            let range = b.range * (b.isEngaged ? 1.4 : 1)

            if toks.contains("wall") {
                let pad: Float = 6
                if abs(x - b.center.x) < b.box.hw + pad && abs(y - b.center.y) < b.box.hh + pad {
                    kick = Vec3((x < b.center.x ? -1 : 1) * 1.6, (y < b.center.y ? -1 : 1) * 0.8, 0)
                    hit = true
                }
            }
            if !hit && (toks.contains("attract") || toks.contains("sink") || toks.contains("jet")) {
                if dist < range * 0.8 {
                    let k: Float = 1.2 + (b.isEngaged ? 1.6 : 0)
                    kick = (d3 / dist) * k
                    hit = true
                }
            }
            if !hit && toks.contains("repel") && dist < range * 0.8 {
                let k: Float = 1.2 + (b.isEngaged ? 1.2 : 0)
                kick = -(d3 / dist) * k
                hit = true
            }
            if !hit && toks.contains("swirl") && dist < range * 0.75 {
                kick = Vec3(d3.y / dist, -d3.x / dist, 0) * 1.2
                hit = true
            }
            if !hit && toks.contains("stream") && dist < range * 0.75 {
                kick = b.heading * 1.3
                hit = true
            }
            // every other force-bearing body also frees nearby bound matter, with a gentle
            // inward nudge, so the integrator's real force can act on it (§2.4).
            if !hit && dist < range * 0.8 && exertsForce(b) {
                let k: Float = 0.8 + (b.isEngaged ? 0.8 : 0)
                kick = (d3 / dist) * k
                hit = true
            }
            if hit { break }
        }

        if hit {
            let np = Particle(position: Vec3(x, y, 0), velocity: kick, heat: 0.5, size: p.size)
            spawn(np)
            let last = bound.removeLast()
            if i < bound.count { bound[i] = last }
        }
    }
}

/// Charge induction (§20.10) — a *field-level* polarization, separate from the force.
/// A charge/magnetism body polarizes the neutral matter that enters its field: a neutral
/// particle picks up a sign by which side of the body it sits on. Induced once — matter
/// carries its sign thereafter. Lives here, not in the force's apply, so the force's
/// golden contract ("ignores neutral matter") stays exactly true.
public func induceCharges(bodies: [Body], particles: [Particle]) {
    for b in bodies {
        if !b.isVisible { continue }
        if !b.tokens.contains("charge") && !b.tokens.contains("magnetism") { continue }
        if b.range <= 0 { continue } // a global field has no side to polarize by
        let r2 = b.range * b.range
        for p in particles {
            if let q = p.charge, q != 0 { continue } // already signed — matter carries its charge
            let d3 = b.center - p.position
            if simd_length_squared(d3) >= r2 { continue }
            p.charge = d3.x >= 0 ? 1 : -1 // polarize by side → a two-domain +/- split
        }
    }
}
