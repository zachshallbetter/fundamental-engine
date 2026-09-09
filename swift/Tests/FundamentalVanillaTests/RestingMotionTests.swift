import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalVanilla
import FundamentalCore

// The resting-motion floor (board #24 "resting liveliness") — the Swift mirror of
// packages/core/src/resting-motion-floor.test.ts. DECLARED, default OFF: an idle field with the ambient
// drift stilled settles to rest (the default step is unchanged — the golden stays byte-identical); the
// `.thermal` and `.flow` floors each keep it alive with nothing drawn; `.flow` is divergence-free by
// construction; `.thermal` draws through the seeded rng so a run reproduces; reduced motion contributes nothing.
@Suite("Resting-motion floor")
struct RestingMotionTests {

    private func idle(seed: UInt32, _ resting: RestingMotion?, host: HeadlessFieldHost = HeadlessFieldHost()) -> (FieldField, HeadlessFieldHost) {
        let field = FieldField(host: host, options: .init(ambientOrbit: 0, ambientWander: 0, restingMotion: resting, rng: seededRng(seed)))
        return (field, host)
    }

    private func positions(_ field: FieldField) -> [Float] {
        var out = [Float](repeating: 0, count: field.particleCount() * 5)
        let n = field.readParticles(into: &out)
        var pos: [Float] = []
        pos.reserveCapacity(n * 2)
        for i in 0..<n { pos.append(out[5 * i]); pos.append(out[5 * i + 1]) }
        return pos
    }

    /// mean per-frame displacement over `frames` frames (edge wraps excluded).
    private func meanStep(_ field: FieldField, _ host: HeadlessFieldHost, from frame: Int, frames: Int = 30) -> Float {
        var sum: Float = 0; var n = 0
        var prev = positions(field)
        for f in 0..<frames {
            host.fire(at: TimeInterval(frame + f) / 60)
            let cur = positions(field)
            var i = 0
            while i + 1 < cur.count {
                let dx = cur[i] - prev[i], dy = cur[i + 1] - prev[i + 1]
                if abs(dx) <= 50, abs(dy) <= 50 { sum += (dx * dx + dy * dy).squareRoot(); n += 1 }
                i += 2
            }
            prev = cur
        }
        return n == 0 ? 0 : sum / Float(n)
    }

    private func settled(_ resting: RestingMotion?, seed: UInt32 = 1) -> Float {
        let (field, host) = idle(seed: seed, resting)
        for i in 0..<240 { host.fire(at: TimeInterval(i) / 60) } // let the seeded launch velocities decay
        let s = meanStep(field, host, from: 240)
        field.destroy()
        return s
    }

    @Test("restingFlow is divergence-free by construction, and not trivial")
    func divergenceFree() {
        let rng = seededRng(42)
        let h: Float = 1e-2
        var maxDiv: Float = 0, maxMag: Float = 0
        for _ in 0..<200 {
            let x = rng() * 800, y = rng() * 600, phase = rng() * 2 * .pi
            let dvxdx = (restingFlow(x: x + h, y: y, phase: phase).x - restingFlow(x: x - h, y: y, phase: phase).x) / (2 * h)
            let dvydy = (restingFlow(x: x, y: y + h, phase: phase).y - restingFlow(x: x, y: y - h, phase: phase).y) / (2 * h)
            maxDiv = max(maxDiv, abs(dvxdx + dvydy))
            let v = restingFlow(x: x, y: y, phase: phase)
            maxMag = max(maxMag, (v.x * v.x + v.y * v.y).squareRoot())
        }
        #expect(maxDiv < 1e-3) // f32 finite differences
        #expect(maxMag > 0.5)
    }

    @Test("OFF is really off: an idle field with the ambient drift stilled settles to rest")
    func offIsOff() {
        #expect(settled(nil) < 0.02)
    }

    @Test("the thermal floor keeps an idle field alive with nothing drawn")
    func thermalFloor() {
        #expect(settled(RestingMotion(mode: .thermal)) > 0.08)
    }

    @Test("the flow floor keeps an idle field alive with nothing drawn")
    func flowFloor() {
        #expect(settled(RestingMotion(mode: .flow)) > 0.08)
    }

    @Test("strength 0 is the off path; strength scales the floor")
    func strengthScales() {
        #expect(settled(RestingMotion(mode: .thermal, strength: 0)) < 0.02)
        let one = settled(RestingMotion(mode: .thermal, strength: 1))
        let two = settled(RestingMotion(mode: .thermal, strength: 2))
        #expect(two > one * 1.5)
    }

    @Test("reduced motion: the floor contributes exactly nothing (dt = 0)")
    func reducedMotion() {
        for mode in [RestingMotionMode.thermal, .flow] {
            let host = HeadlessFieldHost()
            host.prefersReducedMotion = true
            let (field, _) = idle(seed: 1, RestingMotion(mode: mode), host: host)
            let before = positions(field)
            for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }
            #expect(positions(field) == before)
            field.destroy()
        }
    }

    @Test("thermal draws through the injected rng: a seeded run reproduces, a different seed diverges")
    func seededDeterminism() {
        func run(_ seed: UInt32) -> [Float] {
            let (field, host) = idle(seed: seed, RestingMotion(mode: .thermal))
            for i in 0..<120 { host.fire(at: TimeInterval(i) / 60) }
            let p = positions(field)
            field.destroy()
            return p
        }
        #expect(run(7) == run(7))
        #expect(run(7) != run(8))
    }
}
