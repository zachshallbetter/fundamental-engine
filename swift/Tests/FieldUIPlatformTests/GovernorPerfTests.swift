import Testing
@testable import FieldUIPlatform

@Suite("QualityGovernor")
struct QualityGovernorTests {

    @Test("escalates to tier 1 after 10 sustained overrun frames, not before") func escalates() {
        let g = QualityGovernor()
        for _ in 0..<9 { #expect(g.feed(25) == nil) } // 25ms > 20, but streak < 10
        #expect(g.feed(25) == .reduced)               // the 10th trips it
        #expect(g.tier == .reduced)
    }

    @Test("a clean frame resets the overrun streak (escalation needs CONSECUTIVE overruns)") func consecutive() {
        let g = QualityGovernor()
        for _ in 0..<9 { _ = g.feed(25) }
        #expect(g.feed(10) == nil)   // clean — streak resets
        for _ in 0..<9 { #expect(g.feed(25) == nil) }
        #expect(g.feed(25) == .reduced) // needs a fresh run of 10
    }

    @Test("recovery is asymmetric: 30 clean frames drop a tier") func recovers() {
        let g = QualityGovernor()
        for _ in 0..<10 { _ = g.feed(25) }
        #expect(g.tier == .reduced)
        for _ in 0..<29 { #expect(g.feed(10) == nil) } // not yet
        #expect(g.feed(10) == .full)                   // the 30th recovers
    }

    @Test("reset clears the tier and streaks") func reset() {
        let g = QualityGovernor()
        for _ in 0..<10 { _ = g.feed(60) }
        g.reset()
        #expect(g.tier == .full)
    }
}

@Suite("FieldPerf")
struct FieldPerfTests {

    @Test("steady 16ms frames → ~62 fps, a ~16ms budget, nothing dropped") func steady() {
        let p = FieldPerf(window: 180, budgetSeed: 30)
        var t = 0.0
        for _ in 0..<60 { p.feed(t); t += 16 }
        let s = p.snapshot()
        #expect(s.budgetMs == 16)
        #expect(s.medianMs == 16)
        #expect(s.fps == 63)        // round(1000/16) = 63
        #expect(s.dropped == 0)
        #expect(s.frames == 59)     // 60 timestamps → 59 deltas
    }

    @Test("a discontinuity gap (>500ms) is ignored, not measured") func discontinuity() {
        let p = FieldPerf()
        p.feed(0); p.feed(16)        // one 16ms delta
        p.feed(2000)                 // a ~2s gap → skipped
        p.feed(2016)                 // resumes: another 16ms delta
        #expect(p.snapshot().frames == 2) // the gap delta was not counted
    }

    @Test("a delta past budget × 1.5 counts as dropped once the budget exists") func dropped() {
        let p = FieldPerf(window: 180, budgetSeed: 5)
        var t = 0.0
        for _ in 0..<6 { p.feed(t); t += 16 } // 5 deltas seed budget = 16
        p.feed(t + 40)                         // a 40ms delta > 16 × 1.5 = 24 → dropped
        #expect(p.snapshot().dropped == 1)
    }
}
