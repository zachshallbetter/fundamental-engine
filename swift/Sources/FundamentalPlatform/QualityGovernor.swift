import Foundation

// MARK: - QualityGovernor (platform/governor.ts)
//
// Detects sustained frame-budget overruns and emits a tier signal so the caller can adapt
// render quality without a hard cutoff. The governor *detects*; the caller *responds*.
//
//   0 = full quality       2 = minimal  (caller: render → dots, halve the particle cap)
//   1 = effects reduced     3 = paused   (caller: suspend the field loop)
//
// Feed it frame durations (ms); escalation fires after N consecutive overrun frames, recovery
// requires a longer clean run (asymmetric, to avoid thrashing at the boundary). Skip
// discontinuity frames and `reset()` on background/foreground transitions.

public enum QualityTier: Int, Sendable {
    case full = 0, reduced = 1, minimal = 2, paused = 3
}

public final class QualityGovernor {
    private struct TierRule { let aboveMs: Double; let streak: Int; let tier: QualityTier }
    private static let escalate: [TierRule] = [
        .init(aboveMs: 20, streak: 10, tier: .reduced),
        .init(aboveMs: 33, streak: 5, tier: .minimal),
        .init(aboveMs: 50, streak: 3, tier: .paused),
    ]
    private static let recoverStreak = 30 // clean frames before dropping a tier

    private var _tier: QualityTier = .full
    private var overrunStreak = 0
    private var cleanStreak = 0
    private let budget: Double

    public init(budgetMs: Double = 16.67) { budget = budgetMs }

    public var tier: QualityTier { _tier }

    /// Feed one frame duration (ms). Returns the new tier when it changes, `nil` when stable.
    @discardableResult
    public func feed(_ durationMs: Double) -> QualityTier? {
        let overrun = durationMs > budget * 1.3
        if overrun {
            cleanStreak = 0
            overrunStreak += 1
            for rule in Self.escalate where durationMs > rule.aboveMs
                && overrunStreak >= rule.streak && _tier.rawValue < rule.tier.rawValue {
                _tier = rule.tier
                return _tier
            }
        } else {
            overrunStreak = 0
            if _tier.rawValue > 0 {
                cleanStreak += 1
                if cleanStreak >= Self.recoverStreak {
                    cleanStreak = 0
                    _tier = QualityTier(rawValue: max(0, _tier.rawValue - 1)) ?? .full
                    return _tier
                }
            }
        }
        return nil
    }

    public func reset() {
        _tier = .full
        overrunStreak = 0
        cleanStreak = 0
    }
}
