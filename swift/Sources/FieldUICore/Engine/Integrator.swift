import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - The integrator (§2.2, §7)
//
// Advances the field one tick. For each free particle: apply body forces (§4), the
// formation bias (§7), then integrate and damp. Under first-class mass (§21.3) each
// additive body force is scaled by 1/m as it applies, while velocity-replacing
// (`kinematic`) forces are left untouched. Reduced motion (dt = 0) freezes the sim (§18).
//
// Direct port of packages/core/src/core/integrator.ts, lifted to 3D. The carrier-wave
// drift (§2.3, currents.ts) is not yet ported — `step` runs the bodies-and-formations
// field; waves slot in where the JS reads `input.waves`.

public let FRICTION: Float = 0.95
public let HEAT_DECAY: Float = 0.972
private let EDGE: Float = 10

public struct StepInput {
    public var store: FieldStore
    public var bodies: [Body]
    public var env: Env
    public var forces: ForceRegistry
    public var conditions: ConditionRegistry
    /// The carrier waves — free particles drift along their slope (§2.3).
    public var waves: [Wave]?

    public init(store: FieldStore, bodies: [Body], env: Env, forces: ForceRegistry,
                conditions: ConditionRegistry = [:], waves: [Wave]? = nil) {
        self.store = store
        self.bodies = bodies
        self.env = env
        self.forces = forces
        self.conditions = conditions
        self.waves = waves
    }
}

private func passes(_ conds: ConditionRegistry, _ b: Body, _ p: Particle, _ env: Env) -> Bool {
    guard !b.when.isEmpty else { return true }
    guard let fn = conds[b.when] else { return true }
    return fn(b, p, env)
}

/// The body's classified token sets, memoized — `tokens` never changes after construction.
@inline(__always)
private func classified(_ b: Body) -> ClassifiedTokens {
    if let c = b.classified { return c }
    let c = classifyBodyTokens(b.tokens)
    b.classified = c
    return c
}

/// Apply one force to a particle, honouring first-class mass (§21.3): an *additive* force's
/// velocity change is scaled by 1/m (a = F/m), while a `kinematic` force (a reflection /
/// rotation / relaunch) sets velocity outright and is left unscaled.
@inline(__always)
private func applyForce(_ f: any Force, _ b: Body, _ p: Particle, _ env: Env, _ inv: Float) {
    if inv == 1 || f.isKinematic {
        f.apply(body: b, particle: p, env: env)
        return
    }
    let before = p.velocity
    f.apply(body: b, particle: p, env: env)
    p.velocity = before + (p.velocity - before) * inv
}

public func step(_ input: StepInput) {
    let store = input.store
    let bodies = input.bodies
    let env = input.env
    let forces = input.forces
    let conditions = input.conditions
    let dt = env.dt
    if dt == 0 { return }
    let W = env.volume.x
    let H = env.volume.y
    let D = env.volume.z
    let form = env.form

    // expose the net structure field so field-following forces can read the superposition.
    env.fieldAt = { p in netField(bodies: bodies, forces: forces, at: p) }

    for b in bodies {
        b.count = 0
        if b.thermo != nil { b.thermo = Body.Thermo() }
    }

    // visible `screen` bodies: each damps OTHER bodies' forces on matter inside its range.
    // No screens (the common case) ⇒ nil and the whole pass is skipped — zero cost.
    var screens: [Body]? = nil
    for b in bodies where b.isVisible && !b.tokens.isEmpty && classified(b).modifiers.contains("screen") {
        screens == nil ? (screens = [b]) : screens!.append(b)
    }
    var screenFall: [Float] = screens.map { Array(repeating: Float(1), count: $0.count) } ?? []

    let hasBodies = !bodies.isEmpty
    var dead: [Particle]? = nil // mortal (spawned) matter that expired this tick
    // the accretion target for `conv` — the first visible sink body (§7).
    let conv = form.conv > 0.02 ? accretionTarget(bodies) : nil

    let waves = input.waves
    let hasWaves = !(waves?.isEmpty ?? true)

    for p in store.particles {
        // captured matter is held inside a sink core, drifting to it (§6.9).
        if let cap = p.cap {
            p.position += (cap.center - p.position) * 0.18
            continue
        }

        // wave current (§2.3): near a wave line, drift along its slope like debris.
        if hasWaves, let waves {
            var near: Wave? = nil
            var nd: Float = 1e9
            for w in waves {
                let d = abs(waveYat(w, x: p.position.x, time: env.t, H: H) - p.position.y)
                if d < nd {
                    nd = d
                    near = w
                }
            }
            if let near, nd < 70 {
                p.velocity.x += near.dir * 0.035 * (1 - nd / 70)
                p.velocity.y += waveSlope(near, x: p.position.x, time: env.t) * 0.1 * (1 - nd / 70)
            }
        }

        // formation currents (§7), before the body forces: a lateral lane, an
        // even-scatter pull toward a per-particle target, and convergence to the core.
        if form.driftX != 0 { p.velocity.x += form.driftX * 0.02 }
        if form.spread > 0.02 {
            let tx = ((p.gx + Float(env.frameN) * 0.00004).truncatingRemainder(dividingBy: 1)) * W
            let ty = p.gy * H
            let tz = D > 0 ? p.gz * D : 0
            p.velocity += (Vec3(tx, ty, tz) - p.position) * (0.0006 * form.spread)
        }
        if let conv {
            let cd = conv.center - p.position
            let d = max(simd_length(cd), 1)
            p.velocity += (cd / d) * (form.conv * 0.06)
        }

        // body forces — the registered elements move the field (§4).
        if hasBodies {
            // per-particle screen factors: one distance per screen body, computed once
            // and reused across every body's pass below.
            if let screens {
                for i in screens.indices {
                    let s = screens[i]
                    screenFall[i] = screenFactor(
                        d: simd_length(s.center - p.position),
                        range: s.range,
                        strength: s.strength,
                        min: s.screenMin ?? 0
                    )
                }
            }
            // first-class mass (§21.3): an additive force's Δv is scaled by 1/m as it applies.
            let inv: Float = (p.mass != 1 && p.mass > 0) ? 1 / p.mass : 1
            for b in bodies {
                if !b.isVisible || b.tokens.isEmpty { continue }
                // shaped sources (Stage C): reference the nearest point on the element's box,
                // not its centre, so matter shells the shape. Inside the box delta = 0 → no
                // directional pull, the right no-op.
                let delta: Vec3
                if b.shaped {
                    delta = nearestOnBox(p.position, b.box) - p.position
                } else {
                    delta = b.center - p.position
                }
                let d2 = simd_length_squared(delta)
                // range cull: a ranged body can't reach past ~1.6× its range (the largest
                // on-state multiplier). Skip the sqrt, the modifier pass, and every apply
                // for matter beyond it. range 0 = global → never culled.
                if b.range > 0 && d2 >= b.range * b.range * 2.56 { continue }
                let d = sqrt(d2)
                // density sampling for two-way feedback (engine bookkeeping, ungated, §8) —
                // and the thermodynamic sample, same window, same cadence.
                if b.feedback && d < b.range * 0.5 {
                    b.count += 1 - d / (b.range * 0.5)
                    var th = b.thermo ?? Body.Thermo()
                    let s2 = simd_length_squared(p.velocity)
                    th.n += 1
                    th.sv += p.velocity
                    th.ss += sqrt(s2)
                    th.ss2 += s2
                    th.sh += p.heat
                    b.thermo = th
                }
                if !b.when.isEmpty && !passes(conditions, b, p, env) { continue }
                env.vector = delta
                env.dist = d < 1 ? 1 : d
                // modifier pass (§20.3, the workover v0.3 modifier contract): the body's OWN
                // modifiers evaluate in contract order (cls.modifiers is pre-sorted), then any
                // custom modify() hooks on its other tokens. Gates OR, strengths multiply.
                let cls = classified(b)
                var sMul: Float = 1
                var gated = false
                var hasModifier = false
                for tok in cls.modifiers {
                    guard let force = forces[tok], force.hasModify else { continue }
                    hasModifier = true
                    guard let m = force.modify(body: b, particle: p, env: env) else { continue }
                    if let s = m.strength { sMul *= s }
                    if m.gate { gated = true }
                }
                for tok in cls.forces {
                    guard let force = forces[tok], force.hasModify else { continue }
                    hasModifier = true
                    guard let m = force.modify(body: b, particle: p, env: env) else { continue }
                    if let s = m.strength { sMul *= s }
                    if m.gate { gated = true }
                }
                if gated { continue } // spotlight cone excludes this particle
                // `screen`: OTHER bodies' quiet zones damp this body's force on this particle.
                // A screen never damps itself.
                var screenMul: Float = 1
                if let screens {
                    for i in screens.indices where screens[i] !== b {
                        screenMul *= screenFall[i]
                    }
                }
                // conserved-attention multiplier (§2.4): 1 = neutral.
                let attn = b.attn ?? 1
                let mul = sMul * attn * screenMul
                if !hasModifier && mul == 1 {
                    // the untouched fast path
                    for tok in b.tokens {
                        if let f = forces[tok] { applyForce(f, b, p, env, inv) }
                    }
                } else if !hasModifier {
                    let origS = b.strength
                    b.strength = origS * mul
                    for tok in b.tokens {
                        if let f = forces[tok] { applyForce(f, b, p, env, inv) }
                    }
                    b.strength = origS
                } else {
                    // a modifier ran: apply only the non-modifier modules, at scaled strength
                    let origS = b.strength
                    b.strength = origS * mul
                    for tok in b.tokens {
                        if let f = forces[tok], !f.hasModify { applyForce(f, b, p, env, inv) }
                    }
                    b.strength = origS
                }
            }
        }

        // global safety cap (§20.10): no token or composite may drive a free particle past c.
        let cap = env.c
        let sp2 = simd_length_squared(p.velocity)
        if sp2 > cap * cap {
            p.velocity *= cap / sqrt(sp2)
        }

        // integrate, then damp (§2.2).
        p.position += p.velocity * dt
        p.velocity *= FRICTION

        // wander (after damping, so it stays lively): a periodic brownian jitter every
        // 40 frames, plus a smooth curl-noise eddy (§7). The curl stays planar; the
        // brownian kick gains a z component in a volumetric field.
        if env.frameN % 40 == 0 && form.wander > 0 {
            let wsc = 0.05 * form.wander
            p.velocity.x += (Float.random(in: 0..<1) - 0.5) * wsc
            p.velocity.y += (Float.random(in: 0..<1) - 0.5) * wsc
            if D > 0 { p.velocity.z += (Float.random(in: 0..<1) - 0.5) * wsc }
        }
        if form.wander > 0.05 {
            let cn = (sin(p.position.x * 0.0032 + env.t * 0.12)
                    + cos(p.position.y * 0.0034 - env.t * 0.15)) * .pi
            p.velocity.x += cos(cn) * 0.013 * form.wander
            p.velocity.y += sin(cn) * 0.013 * form.wander
        }

        p.heat *= HEAT_DECAY

        // mortal matter ages (the class-[S] sink): spawned particles carry a finite `age`
        // and despawn at ≤ 0. Immortal base-field matter (age nil) is untouched.
        if p.age != nil {
            p.age! -= dt
            if p.age! <= 0 {
                dead == nil ? (dead = [p]) : dead!.append(p)
            }
        }

        // toroidal wrap at the edges (z wraps only in a volumetric field).
        if p.position.x < -EDGE { p.position.x = W + EDGE }
        else if p.position.x > W + EDGE { p.position.x = -EDGE }
        if p.position.y < -EDGE { p.position.y = H + EDGE }
        else if p.position.y > H + EDGE { p.position.y = -EDGE }
        if D > 0 {
            if p.position.z < -EDGE { p.position.z = D + EDGE }
            else if p.position.z > D + EDGE { p.position.z = -EDGE }
        }
    }

    // class-[S] sources (§20.1): a body-level pass *after* the per-particle loop, so a
    // source emits matter once per frame (not once per existing particle) via env.spawn.
    if hasBodies {
        for b in bodies where b.isVisible && !b.tokens.isEmpty {
            for tok in b.tokens { forces[tok]?.source(body: b, env: env) }
        }
    }

    // remove expired mortal matter (swap-remove is O(1); order is not significant).
    if let dead {
        for p in dead { store.remove(p) }
    }
}
