import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalVanilla
import FundamentalCore

// MARK: - The determinism seam, whole-run (#974)
//
// The Swift mirror of the JS record/replay determinism contract (#371 / #692,
// packages/core/src/record/record.test.ts): a field built with a seeded `FieldOptions.rng` and driven
// on a manual clock reproduces bit-for-bit — pool seeding, the wave-bound riders, the integrator's
// brownian wander, thermal's Box–Muller kicks, jet's nozzle cone, spawn's emission cone, and the
// burst's spark draws all flow through the one injected source. A different seed diverges. Exact
// equality, not tolerance. Unseeded fields keep today's platform randomness (the default is unchanged).

@Suite("Whole-run determinism (#974)")
struct EngineDeterminismTests {

    /// Run a field that exercises every engine rng consumer, and return its packed particle state.
    private func fingerprint(seed: UInt32, frames: Int = 120) -> [Float] {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init(waves: true, rng: seededRng(seed)))
        // ambient formation → wander 1.0 (the integrator's periodic brownian kick fires every 40 frames)
        _ = field.addBody(BodySpec(tokens: ["thermal"], strength: 1.2, range: 500,
                                   rect: { Box(center: Vec3(180, 400, 0), halfExtents: Vec3(40, 20, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["jet"], strength: 1, range: 320,
                                   rect: { Box(center: Vec3(100, 200, 0), halfExtents: Vec3(40, 20, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["spawn"], strength: 0.6, range: 200,
                                   rect: { Box(center: Vec3(300, 600, 0), halfExtents: Vec3(40, 20, 0)) }))
        for i in 0..<frames {
            if i == 30 { field.burst(at: Vec3(200, 400, 0), color: nil) } // spark counts + angles
            host.fire(at: TimeInterval(i) / 60)
        }
        var out = [Float](repeating: 0, count: field.particleCount() * 5)
        let n = field.readParticles(into: &out)
        field.destroy()
        return [Float(n)] + out
    }

    @Test("same seed → the run reproduces bit-for-bit")
    func sameSeedReproduces() {
        let a = fingerprint(seed: 42)
        let b = fingerprint(seed: 42)
        #expect(!a.isEmpty && a.count > 1, "the run produced a non-empty fingerprint")
        #expect(a == b, "same seed → identical particle state after 120 frames")
    }

    @Test("a different seed produces a different run")
    func differentSeedDiverges() {
        let a = fingerprint(seed: 1)
        let b = fingerprint(seed: 2)
        #expect(a != b, "distinct seeds must not produce the same run")
    }
}
