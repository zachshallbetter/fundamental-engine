import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalVanilla
import FundamentalCore

// MARK: - Pause / resume (#605)
//
// The loop-lifecycle contract: `pause()` stops the display link without touching simulation
// state, `resume()` restarts it, both are idempotent, and the host's visibility seam drives the
// same gate automatically (presentation-aware auto-pause). All through the FieldHost protocol
// seam — HeadlessFieldHost stands in for the CADisplayLink hosts, so this runs everywhere.

@Suite("Pause / resume (#605)")
struct PauseResumeTests {

    @Test("pause() stops ticks; resume() restarts them; state survives")
    func pauseStopsResumeRestarts() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var ticks = 0
        field.on(.tick) { _ in ticks += 1 }

        host.fire(at: 0)
        #expect(ticks == 1)

        field.pause()
        host.fire(at: 1.0 / 60) // the link is cancelled — nothing to fire
        #expect(ticks == 1)
        #expect(field.particleCount() == 130) // simulation state retained, not torn down

        field.resume()
        host.fire(at: 2.0 / 60)
        #expect(ticks == 2)
        field.destroy()
    }

    @Test("double-pause and double-resume are no-ops")
    func idempotency() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var ticks = 0
        field.on(.tick) { _ in ticks += 1 }
        #expect(host.scheduleCount == 1) // the boot schedule

        field.pause()
        field.pause() // second pause: already stopped — no crash, still paused
        host.fire(at: 0)
        #expect(ticks == 0)

        field.resume()
        #expect(host.scheduleCount == 2)
        field.resume() // second resume: already running — must NOT reschedule a second loop
        #expect(host.scheduleCount == 2)
        host.fire(at: 1.0 / 60)
        #expect(ticks == 1) // exactly one live loop
        field.destroy()
    }

    @Test("visibility seam auto-pauses while the host reports hidden, resumes on return")
    func visibilityAutoPause() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var ticks = 0
        field.on(.tick) { _ in ticks += 1 }

        host.hidden = true
        host.fireVisibility() // app backgrounded / window occluded / isPaused SPI flipped
        host.fire(at: 0)
        #expect(ticks == 0) // the link was cancelled, not just guard-skipped

        host.hidden = false
        host.fireVisibility() // back to the foreground
        host.fire(at: 1.0 / 60)
        #expect(ticks == 1)
        field.destroy()
    }

    @Test("an explicit pause is sticky — a visibility resume never overrides it")
    func explicitPauseSticky() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var ticks = 0
        field.on(.tick) { _ in ticks += 1 }

        field.pause()
        host.hidden = true
        host.fireVisibility()
        host.hidden = false
        host.fireVisibility() // host says visible again — but the caller's pause holds
        host.fire(at: 0)
        #expect(ticks == 0)

        field.resume() // only the explicit resume releases it
        host.fire(at: 1.0 / 60)
        #expect(ticks == 1)
        field.destroy()
    }

    @Test("no time-jump on resume — a long pause never integrates as elapsed time")
    func noTimeJumpOnResume() {
        let host = HeadlessFieldHost()
        // waves off: the bound↔free reservoir would tear/heal matter between the two readings,
        // churning the pool's size and order — this test needs a stable, index-comparable pool.
        let field = FieldField(host: host, options: .init(waves: false))
        field.burst(at: Vec3(187, 406, 0)) // give matter real velocity
        host.fire(at: 0)
        host.fire(at: 1.0 / 60)

        let n = field.particleCount()
        var before = [Float](repeating: 0, count: n * 5)
        #expect(field.readParticles(into: &before) == n)

        field.pause()
        field.resume()
        host.fire(at: 100) // a ~100 s wall-clock gap across the pause

        var after = [Float](repeating: 0, count: n * 5)
        #expect(field.readParticles(into: &after) == n)
        // One resumed frame moves matter one frame's worth (dt re-based to 1), never 100 s worth.
        // Displacement is measured modulo the toroidal wrap so an edge crossing doesn't read as a jump.
        func wrapped(_ d: Float, _ span: Float) -> Float { min(abs(d), span - abs(d)) }
        var maxDisplacement: Float = 0
        for i in 0..<n {
            let dx = wrapped(after[i * 5] - before[i * 5], 375)
            let dy = wrapped(after[i * 5 + 1] - before[i * 5 + 1], 812)
            maxDisplacement = max(maxDisplacement, (dx * dx + dy * dy).squareRoot())
        }
        // env.c caps speed at 12 px/frame; dt = 1 on the resumed frame ⇒ ≲ 12 px + wander. A real
        // 100 s time-jump would integrate ~6000 dt-units and land far beyond any per-frame bound.
        #expect(maxDisplacement < 40)
        field.destroy()
    }

    @Test("resume after destroy stays dead")
    func resumeAfterDestroy() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        #expect(host.scheduleCount == 1)
        field.destroy()
        field.resume() // must not resurrect the loop on a torn-down field
        #expect(host.scheduleCount == 1)
    }
}
