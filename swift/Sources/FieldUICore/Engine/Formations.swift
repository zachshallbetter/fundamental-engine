import simd

// MARK: - Formation helpers (§7)

/// Ease `current` toward `target` in place, per term (lerp `rate`/frame, §7) —
/// transitions glide rather than snap.
public func easeFormation(_ current: inout Formation, toward target: Formation, rate: Float = 0.03) {
    current.driftX += (target.driftX - current.driftX) * rate
    current.wander += (target.wander - current.wander) * rate
    current.orbit  += (target.orbit  - current.orbit)  * rate
    current.spread += (target.spread - current.spread) * rate
    current.conv   += (target.conv   - current.conv)   * rate
}

/// The accretion target for `conv` — the first visible body that absorbs (§7).
public func accretionTarget(_ bodies: [Body]) -> Body? {
    bodies.first { $0.isVisible && $0.tokens.contains("sink") }
}

// MARK: - Formation presets (forces.config FORMATIONS)

public struct FormationDef: Sendable {
    public let id: String
    public let name: String
    public let cue: String
    public let preset: Formation
}

/// The five global formations, exactly as configured in the JS catalog.
public let FORMATIONS: [FormationDef] = [
    FormationDef(id: "ambient",   name: "Ambient",   cue: "resting drift",
                 preset: Formation(driftX: 0,    wander: 1.0, orbit: 0.1,  spread: 0,   conv: 0)),
    FormationDef(id: "wells",     name: "Wells",     cue: "matter pools",
                 preset: Formation(driftX: 0,    wander: 0.7, orbit: 0.85, spread: 0,   conv: 0)),
    FormationDef(id: "lanes",     name: "Lanes",     cue: "a current carries",
                 preset: Formation(driftX: 0.55, wander: 0.5, orbit: 0,    spread: 0,   conv: 0)),
    FormationDef(id: "scatter",   name: "Scatter",   cue: "energy dispersed",
                 preset: Formation(driftX: 0,    wander: 1.7, orbit: 0,    spread: 0.6, conv: 0)),
    FormationDef(id: "accretion", name: "Accretion", cue: "everything gathers",
                 preset: Formation(driftX: 0,    wander: 0.6, orbit: 0.4,  spread: 0,   conv: 0.6)),
]

public func formation(named id: String) -> FormationDef? {
    FORMATIONS.first { $0.id == id }
}
