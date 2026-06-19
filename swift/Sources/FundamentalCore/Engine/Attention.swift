import Foundation

// MARK: - Conserved attention (attention.ts, §2.4 + Concept 2)
//
// One finite *strength budget* for the whole page. Engaging a body raises its demand
// and, because the total is conserved, pulls allocation off every other body: the field
// physically cannot emphasise two things at once.
//
//   demandᵢ = 1 + β·onᵢ
//   mulᵢ    = demandᵢ · (Σ Sⱼ / Σ Sⱼ·demandⱼ)
//
// Rest-neutral (all 1 when nothing is engaged) and total-strength-conserving
// (Σ Sᵢ·mulᵢ = Σ Sᵢ within the clamp).

public struct AttnInput {
    public var strength: Float
    public var on: Bool

    public init(strength: Float, on: Bool) {
        self.strength = strength
        self.on = on
    }
}

public struct AttnOpts {
    /// Engagement multiplier β — how much harder an engaged body competes.
    public var beta: Float = 2
    /// Clamp floor for the multiplier.
    public var lo: Float = 0.25
    /// Clamp ceiling for the multiplier.
    public var hi: Float = 3

    public init() {}
}

/// The per-body effective-strength multipliers for one frame, index-aligned with
/// `bodies`. All 1 when nothing is engaged or the input is degenerate.
public func attentionMuls(_ bodies: [AttnInput], opts: AttnOpts = AttnOpts()) -> [Float] {
    let n = bodies.count
    var out = [Float](repeating: 1, count: n)
    if n == 0 { return out }

    var sumS: Float = 0
    var sumM: Float = 0
    for b in bodies {
        let s = max(b.strength, 0)
        sumS += s
        sumM += s * (1 + (b.on ? opts.beta : 0))
    }
    if sumS <= 0 || sumM <= 0 { return out } // nothing to allocate → leave neutral

    let k = sumS / sumM // demand normaliser; exactly 1 when nothing is engaged
    for i in 0..<n {
        let demand: Float = 1 + (bodies[i].on ? opts.beta : 0)
        out[i] = clamp(demand * k, opts.lo, opts.hi)
    }
    return out
}

// MARK: - Conserved allocation (water-filling)

public struct AttnAllocItem {
    /// The item's competitive demand — any non-negative magnitude.
    public var urgency: Float
    /// Pinned items sit outside the competition: each takes exactly `cap` off the top.
    public var pinned: Bool

    public init(urgency: Float, pinned: Bool = false) {
        self.urgency = urgency
        self.pinned = pinned
    }
}

/// Distribute `budget` across items proportional to urgency, capping each weight at
/// `cap` and re-flowing capped excess over the rest (water-filling). Pinned items take
/// exactly `cap` off the top. Invariant: Σ(returned) == budget (±ε) whenever
/// budget ≤ n·cap and the unpinned items carry any positive urgency. Pure; never NaN.
public func allocateAttention(_ items: [AttnAllocItem], budget: Float, cap: Float = 1) -> [Float] {
    let n = items.count
    var w = [Float](repeating: 0, count: n)
    if n == 0 || !(cap > 0) { return w }

    // pins first — each holds exactly `cap`, off the top of the budget.
    var u = [Float](repeating: 0, count: n)
    var free: [Int] = []
    var pinnedCount = 0
    for (i, it) in items.enumerated() {
        if it.pinned {
            w[i] = cap
            pinnedCount += 1
        } else {
            u[i] = it.urgency.isFinite && it.urgency > 0 ? it.urgency : 0
            free.append(i)
        }
    }

    // water-fill the rest: scale urgencies so the round sums to the remaining budget,
    // saturate anything that would exceed `cap`, re-flow the freed budget over the rest.
    var rem = max(0, budget - Float(pinnedCount) * cap)
    var pass = 0
    while pass < n && !free.isEmpty && rem > 0 {
        pass += 1
        let sum = free.reduce(Float(0)) { $0 + u[$1] }
        let k = rem / (sum == 0 ? 1 : sum)
        var still: [Int] = []
        var capped = 0
        for i in free {
            if u[i] * k >= cap {
                w[i] = cap
                capped += 1
            } else {
                still.append(i)
            }
        }
        if capped == 0 {
            for i in still { w[i] = u[i] * k }
            break
        }
        rem -= Float(capped) * cap // provably ≥ 0
        free = still
    }
    return w
}
