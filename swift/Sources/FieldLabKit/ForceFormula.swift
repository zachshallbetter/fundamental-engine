import Foundation

// MARK: - Force formulas — the math, with live numbers
//
// Each force's per-frame law, rendered with the body's CURRENT parameters substituted
// (distance d stays symbolic — it varies per particle). The tunable params drive the live
// bodies, so moving a slider changes both the number in the formula AND the field.

public enum ParamKey: String { case strength, range, spin }

public struct TunableParam {
    public let key: ParamKey
    public let label: String
    public let symbol: String
    public let range: ClosedRange<Double>
    public let step: Double

    public init(_ key: ParamKey, _ label: String, _ symbol: String,
                _ range: ClosedRange<Double>, step: Double = 0.1) {
        self.key = key; self.label = label; self.symbol = symbol
        self.range = range; self.step = step
    }
}

/// One line of a rendered formula: the math (monospaced) + an optional plain-English gloss.
public struct FormulaLine {
    public let math: String
    public let note: String?
    public init(_ math: String, _ note: String? = nil) { self.math = math; self.note = note }
}

public struct ForceFormula {
    public let token: String
    public let title: String
    /// Produce the formula lines for the live (strength, range, spin).
    public let render: (_ strength: Float, _ range: Float, _ spin: Float) -> [FormulaLine]
    public let params: [TunableParam]
}

@inline(__always) private func f2(_ v: Float) -> String { String(format: "%.2f", v) }
@inline(__always) private func f0(_ v: Float) -> String { String(format: "%.0f", v) }

public enum ForceFormulas {

    /// The mass a body sources for gravity/charge — Scenes.makeBodies' `M = 20 + strength·40`.
    public static func bodyMass(_ strength: Float) -> Float { 20 + strength * 40 }

    private static let strengthP = TunableParam(.strength, "Strength", "S", 0.1...3, step: 0.1)
    private static let rangeP = TunableParam(.range, "Range", "r", 60...700, step: 10)
    private static let spinP = TunableParam(.spin, "Spin", "σ", -1...1, step: 1)

    /// The formula for a token, or nil (the panel falls back to params-only for those).
    public static func formula(for token: String) -> ForceFormula? {
        catalog[token]
    }

    private static let catalog: [String: ForceFormula] = {
        var c: [String: ForceFormula] = [:]

        c["attract"] = ForceFormula(token: "attract", title: "Attract (§6.1)", render: { s, r, _ in
            [FormulaLine("v += (1 − d/\(f0(r)))² · \(f2(s)) · 0.5 · d̂", "a soft well — the designed falloff"),
             FormulaLine("+ orbit · (1 − d/\(f0(r)))² · \(f2(s)) · ẑ×d̂", "the formation's orbit bends it into a spiral")]
        }, params: [strengthP, rangeP])

        c["repel"] = ForceFormula(token: "repel", title: "Repel (§6.6)", render: { s, r, _ in
            [FormulaLine("v −= (1 − d/\(f0(r)))² · \(f2(s)) · 0.5 · d̂", "the outward push — carves a void")]
        }, params: [strengthP, rangeP])

        c["swirl"] = ForceFormula(token: "swirl", title: "Swirl (§6.8)", render: { s, r, sp in
            [FormulaLine("f = (1 − d/\(f0(r)))^1.4 · \(f2(s)) · 0.45"),
             FormulaLine("v += σ·f · (d̂×ẑ) + 0.12·f · d̂", "σ=\(f0(sp)): tangential spin + light inward hold")]
        }, params: [strengthP, rangeP, spinP])

        c["stream"] = ForceFormula(token: "stream", title: "Stream (§6.5)", render: { s, r, _ in
            [FormulaLine("v += (1 − d/\(f0(r)))^1.1 · \(f2(s)) · 0.5 · ĥ", "a steady current along the heading ĥ")]
        }, params: [strengthP, rangeP])

        c["viscosity"] = ForceFormula(token: "viscosity", title: "Viscosity (§6.7)", render: { s, r, _ in
            [FormulaLine("k = (1 − d/\(f0(r))) · (0.05 + \(f2(s))·0.07)"),
             FormulaLine("v −= v · k", "thickens the medium — bleeds momentum, no redirection")]
        }, params: [strengthP, rangeP])

        c["tether"] = ForceFormula(token: "tether", title: "Tether (§6.3)", render: { s, r, _ in
            let rest = r * 0.6
            return [FormulaLine("v += (d − \(f0(rest))) · (0.006 + \(f2(s))·0.012)", "a spring at rest length \(f0(rest))"),
                    FormulaLine("v *= 0.985", "damped — settles onto the shell")]
        }, params: [strengthP, rangeP])

        c["jet"] = ForceFormula(token: "jet", title: "Jet (§6.2)", render: { s, r, _ in
            [FormulaLine("d < 24:  v = ĥ · (2.4 + \(f2(s))·2.6)", "at the nozzle: relaunch hot along the heading"),
             FormulaLine("else:    v += (1 − d/\(f0(r)))² · (0.25 + \(f2(s))·0.15) · d̂", "feed: draw matter toward the nozzle")]
        }, params: [strengthP, rangeP])

        c["wall"] = ForceFormula(token: "wall", title: "Wall (§6.4)", render: { _, _, _ in
            [FormulaLine("v ← −v · 0.85  (on the box face)", "an elastic boundary — sparks on hard impact")]
        }, params: [])

        c["sink"] = ForceFormula(token: "sink", title: "Sink (§6.9)", render: { _, _, _ in
            [FormulaLine("d < absorbR:  cap ← this;  accreted += 1", "capture — held, conserved"),
             FormulaLine("accreted ≥ capacity:  supernova → eject", "release exactly what was held, as persistent matter")]
        }, params: [strengthP, rangeP])

        c["gravity"] = ForceFormula(token: "gravity", title: "Gravity (§20.10)", render: { s, _, _ in
            let M = bodyMass(s)
            let eps = 2 * 1 * M / (12 * 12) // 2GM/c², G=1 c=12
            return [FormulaLine("F = G·M / (d² + ε²) · d̂", "the real law — softened inverse-square"),
                    FormulaLine("M = \(f0(M))   ε = 2GM/c² = \(f2(eps))", "Plummer softening keeps the core finite; orbits emerge")]
        }, params: [strengthP])

        c["charge"] = ForceFormula(token: "charge", title: "Charge (§20.3)", render: { s, _, sp in
            let M = bodyMass(s)
            return [FormulaLine("F = σ·q·G·M / (d² + ε²)", "gravity's signed sibling — same kernel"),
                    FormulaLine("σ = \(f0(sp))   M = \(f0(M))", "like repels, opposite attracts; q is the matter's induced charge")]
        }, params: [strengthP, spinP])

        c["magnetism"] = ForceFormula(token: "magnetism", title: "Magnetism (§20.10)", render: { s, r, sp in
            [FormulaLine("θ = q · σ · \(f2(s)) · (1 − d/\(f0(r)))", "the Lorentz turn angle — σ=\(f0(sp))"),
             FormulaLine("v ← rotate(v, θ)", "curves a moving charge ⟂ to v — speed preserved exactly")]
        }, params: [strengthP, rangeP, spinP])

        c["thermal"] = ForceFormula(token: "thermal", title: "Thermal (§20.10)", render: { s, r, _ in
            [FormulaLine("σ = √(2 · \(f2(s)) · (1 − d/\(f0(r))))", "Langevin noise amplitude — a real temperature"),
             FormulaLine("v += σ · ξ,   ξ ~ N(0,1)", "isotropic Gaussian kicks (Box–Muller)")]
        }, params: [strengthP, rangeP])

        c["collide"] = ForceFormula(token: "collide", title: "Collide (§20.10)", render: { s, _, _ in
            [FormulaLine("j = (1 + \(f2(s))) · ½ · (Δv · n̂)", "elastic pairwise impulse, restitution e=\(f2(s))"),
             FormulaLine("vₚ −= j·n̂   v_q += j·n̂", "momentum-conserving hard-sphere contact")]
        }, params: [strengthP])

        c["buoyancy"] = ForceFormula(token: "buoyancy", title: "Buoyancy (§20.3)", render: { s, _, _ in
            [FormulaLine("ρ = 1 / (size · (1 + heat))", "a particle's density falls as it grows or heats"),
             FormulaLine("v_y −= (1 − ρ) · \(f2(s))", "light matter rises (−y), dense settles")]
        }, params: [strengthP])

        c["lens"] = ForceFormula(token: "lens", title: "Lens (§20.3)", render: { s, r, sp in
            [FormulaLine("θ = \(f2(s)) · (1 − d/\(f0(r))) · σ", "σ=\(f0(sp)): a rotation that grows toward the body"),
             FormulaLine("v ← rotate(v, θ)", "bends the path without adding energy")]
        }, params: [strengthP, rangeP, spinP])

        c["spawn"] = ForceFormula(token: "spawn", title: "Spawn (§20.1)", render: { s, _, _ in
            let rate = max(1, (s * 2).rounded())
            return [FormulaLine("rate = max(1, round(\(f2(s))·2)) = \(f0(rate))/frame", "the source emits mortal matter"),
                    FormulaLine("each carries age = life; despawns at 0", "budgeted — the population stays bounded")]
        }, params: [strengthP])

        c["fieldflow"] = ForceFormula(token: "fieldflow", title: "Field Flow (§20.3)", render: { s, r, _ in
            [FormulaLine("û = F_net / |F_net|", "the net field-line tangent (direction only — scale-free)"),
             FormulaLine("v += (û·|v| − v)·k  +  û · \(f2(s))·0.12", "steer onto the line, then stream down it")]
        }, params: [strengthP, rangeP])

        return c
    }()
}
