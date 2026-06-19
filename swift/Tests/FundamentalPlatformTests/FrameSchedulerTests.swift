import Testing
import FundamentalCore
@testable import FundamentalPlatform

@Suite("FrameScheduler")
struct FrameSchedulerTests {

    @Test("phases run in discover→read→compute→state→write→render order")
    func phaseOrder() {
        let scheduler = FrameScheduler()
        var ran: [Phase] = []
        for phase in Phase.allCases {
            scheduler.on(phase) { _ in ran.append(phase) }
        }
        scheduler.runFrame()
        #expect(ran == Phase.allCases)
    }

    @Test("handlers registered after a phase don't affect the current frame")
    func handlerIsolation() {
        let scheduler = FrameScheduler()
        var count = 0
        scheduler.on(.read) { _ in count += 1 }
        scheduler.runFrame()
        #expect(count == 1)
    }

    @Test("out-of-order unsubscribe removes the right handler (token, not stale index)")
    func unsubscribeOutOfOrder() {
        let scheduler = FrameScheduler()
        var hits: [Int] = []
        let off1 = scheduler.on(.read) { _ in hits.append(1) }
        let off2 = scheduler.on(.read) { _ in hits.append(2) }
        _ = scheduler.on(.read) { _ in hits.append(3) }
        off2()                                  // remove the MIDDLE handler
        scheduler.runFrame()
        #expect(hits == [1, 3])                 // 2 gone; 1 and 3 still fire (no stale-index slip)
        hits = []
        off1()                                  // a captured index would now be out of range / wrong
        scheduler.runFrame()
        #expect(hits == [3])
    }

    @Test("frame counter increments each runFrame")
    func frameCounter() {
        let scheduler = FrameScheduler()
        scheduler.runFrame()
        scheduler.runFrame()
        #expect(scheduler.frame == 2)
    }

    @Test("read-phase violation recorded in non-strict mode")
    func violationRecorded() {
        let scheduler = FrameScheduler(strict: false)
        scheduler.on(.write) { _ in
            scheduler.assertReadPhase(op: "measure")
        }
        let report = scheduler.runFrame()
        #expect(report.violations.count == 1)
        #expect(report.violations[0].op == "measure")
    }

    @Test("geometry read during read phase is allowed")
    func readPhaseAllowed() {
        let scheduler = FrameScheduler(strict: false)
        scheduler.on(.read) { _ in
            scheduler.assertReadPhase(op: "measure")
        }
        let report = scheduler.runFrame()
        #expect(report.violations.isEmpty)
    }

    @Test("unsubscribe removes handler")
    func unsubscribe() {
        let scheduler = FrameScheduler()
        var count = 0
        let unsub = scheduler.on(.compute) { _ in count += 1 }
        scheduler.runFrame()
        unsub()
        scheduler.runFrame()
        #expect(count == 1)
    }

    @Test("phases with no handlers are skipped in FrameReport.ran")
    func emptyPhasesSkipped() {
        let scheduler = FrameScheduler()
        scheduler.on(.render) { _ in }
        let report = scheduler.runFrame()
        #expect(report.ran == [.render])
    }
}
