import simd

// MARK: - Micro-reactions (§23)
// "Energy isn't lost — it's spent on spectacle." (§23.1)

/// Kinetic energy removed at an interaction: ½·m·(|v_before|² − |v_after|²) (§23.2).
public func energyDelta(m: Float, vBefore: Float, vAfter: Float) -> Float {
    0.5 * m * (vBefore * vBefore - vAfter * vAfter)
}

/// Reaction intensity from removed energy: clamp(k·ΔE, 0, iMax) (§23.2).
public func reactionIntensity(_ dE: Float, k: Float = 1, iMax: Float = 2.4) -> Float {
    clamp(k * dE, 0, iMax)
}

/// Spark count for a reaction of a given power (§23.3, the wall exemplar).
public func sparkCount(power: Float, rand: () -> Float = { Float.random(in: 0..<1) }) -> Int {
    3 + Int(rand() * (power > 0 ? power : 1) * 3)
}

/// The recoil impulse on the *other* agent in a transfer — equal-and-opposite,
/// split by its mass: Δv = −Δp / m (§23.5). A heavier agent barely budges.
public func recoilImpulse(_ dp: Vec3, mOther: Float) -> Vec3 {
    let m = mOther > 0 ? mOther : 1
    return -dp / m
}

/// A discrete radial burst impulse (§11) — the velocity kick and heat a one-shot
/// `burst(at:)` imparts to matter at offset `delta` from the blast, falling off
/// linearly to nothing at radius `r`; outside `r` it's inert.
public func burstImpulse(delta: Vec3, r: Float, power: Float = 6) -> (dv: Vec3, heat: Float) {
    let d = max(simd_length(delta), 1)
    if d >= r { return (.zero, 0) }
    let falloff = 1 - d / r
    return ((delta / d) * (falloff * power), falloff * 0.9)
}

// MARK: - Accretion (§6.9)

/// Release exactly the particles a body captured: reposition each at the core, give it a
/// radial outward velocity, clear its capture + heat to 1, and reset the body's load to 0.
/// Held matter is **conserved** — released particles stay in the caller's pool. Returns
/// the released particles (in pool order). `rng` is injectable for deterministic tests.
@discardableResult
public func releaseCaptured(
    _ particles: [Particle],
    from b: Body,
    rng: () -> Float = { Float.random(in: 0..<1) }
) -> [Particle] {
    var released: [Particle] = []
    for q in particles where q.cap === b {
        let ang = rng() * .pi * 2
        let spd = 4 + rng() * 3
        q.cap = nil
        q.position = b.center
        q.velocity = Vec3(cos(ang) * spd, sin(ang) * spd, 0)
        q.heat = 1
        // a supernova is a CONSERVATION event: the ejected matter rejoins the persistent
        // field. Mortal (source-spawned) matter that a sink captured and held is released
        // immortal — so a source→sink→supernova loop visibly conserves (the matter the
        // source made becomes lasting field matter, bounded by the engine's pool ceiling),
        // instead of the released particles aging out and vanishing moments later. A no-op
        // for the canonical immortal base pool (age is already nil).
        q.age = nil
        released.append(q)
    }
    b.accreted = 0
    return released
}

/// Sink fill fraction ∈ [0,1] — the value written to the `load` feedback lane. 0 when not a sink.
public func sinkLoad(_ b: Body) -> Float {
    guard b.capacity > 0 else { return 0 }
    return clamp(b.accreted / b.capacity, 0, 1)
}

/// Capture/release event edge for a sink body (§22.5). Pure: the caller persists `armed`.
public enum CaptureEvent { case captured, released }

public func captureEdge(prevArmed: Bool, accreting: Bool) -> (fire: CaptureEvent?, armed: Bool) {
    if accreting && !prevArmed { return (.captured, true) }
    if !accreting && prevArmed { return (.released, false) }
    return (nil, prevArmed)
}
