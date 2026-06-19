import Foundation

// MARK: - FieldPerf (platform/perf.ts)
//
// The frame-duration *measurement* (the QualityGovernor turns sustained overruns into a tier;
// this is the meter). Feed it frame timestamps (ms); read fps / budget / percentiles / dropped.
// Pure and host-driven — no timer of its own.
//
//   - deltas: consecutive feed() differences in a rolling window (default 180).
//   - discontinuity: a gap > 500 ms (tab switch / sleep) is ignored entirely — timing resumes.
//   - budget: the median of the first `budgetSeed` (default 30) clean deltas.
//   - dropped: once the budget exists, a delta > budget × 1.5 increments it (cumulative).

public struct FieldPerfSnapshot: Sendable, Equatable {
    public var fps: Int?
    public var budgetMs: Double?
    public var medianMs: Double?
    public var p95Ms: Double?
    public var p99Ms: Double?
    public var dropped: Int
    public var frames: Int
}

public final class FieldPerf {
    private static let discontinuityMs: Double = 500
    private let windowSize: Int
    private let seedSize: Int
    private var lastTs: Double?
    private var deltas: [Double] = []
    private var seed: [Double] = []
    private var budget: Double?
    private var dropped = 0
    private var frames = 0

    public init(window: Int = 180, budgetSeed: Int = 30) {
        windowSize = max(1, window)
        seedSize = max(1, budgetSeed)
    }

    /// Nearest-rank-by-floor percentile on a sorted copy (the DataConsole's `pct`); `nil` empty.
    private func pct(_ arr: [Double], _ p: Double) -> Double? {
        if arr.isEmpty { return nil }
        let s = arr.sorted()
        return s[Int((p / 100) * Double(s.count - 1))]
    }

    /// Feed one frame timestamp (ms). Gaps > 500 ms are skipped (discontinuity).
    public func feed(_ frameTs: Double) {
        guard let last = lastTs else { lastTs = frameTs; return }
        let d = frameTs - last
        lastTs = frameTs
        if d > Self.discontinuityMs { return } // discontinuity: resume, count nothing
        deltas.append(d)
        if deltas.count > windowSize { deltas.removeFirst() }
        frames += 1
        if budget == nil && seed.count < seedSize {
            seed.append(d)
            if seed.count == seedSize { budget = pct(seed, 50) }
        }
        if let b = budget, d > b * 1.5 { dropped += 1 } // seed-completing delta is checked too
    }

    public func snapshot() -> FieldPerfSnapshot {
        let medianMs = pct(deltas, 50)
        return FieldPerfSnapshot(
            fps: medianMs.map { Int((1000 / $0).rounded()) },
            budgetMs: budget,
            medianMs: medianMs,
            p95Ms: pct(deltas, 95),
            p99Ms: pct(deltas, 99),
            dropped: dropped,
            frames: frames)
    }

    public func reset() {
        lastTs = nil
        deltas = []
        seed = []
        budget = nil
        dropped = 0
        frames = 0
    }
}
