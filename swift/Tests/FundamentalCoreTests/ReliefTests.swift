import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// Height-aware fields (#443) — the `relief` coupling and the `held` grid mode it reads.
// Mirrors the JS `height-fields.test.ts` and the Kotlin `ReliefTests`.

private func heldOver(_ sampler: (Float, Float) -> Float) -> ScalarGridImpl {
    let g = ScalarGridImpl(width: 800, height: 600, mode: .held)
    g.fillFrom(sampler)
    return g
}

private func reliefBody(strength: Float = 1, spin: Float = 1) -> Body {
    Body(tokens: ["relief"], strength: strength, range: 0, spin: spin) // range 0 ⇒ global
}

private func env(_ potential: ((String) -> (any ScalarGrid)?)? = nil) -> Env {
    let e = Env()
    e.dist = 1
    e.potential = potential
    return e
}

@Suite("Relief (declared potentials)")
struct ReliefTests {

    @Test("transports matter DOWN the declared potential, by the declared law")
    func drainsDownhill() {
        let phi = heldOver { x, _ in 0.01 * x } // h rises with x ⇒ −∇Φ points in −x
        let p = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(), particle: p, env: env { _ in phi })
        #expect(p.velocity.x < 0)
        #expect(abs(p.velocity.y) < 1e-6)
        #expect(abs(p.velocity.x + 0.01) < 5e-5) // Δv = −∇Φ·S·G
    }

    @Test("spin < 0 climbs the potential instead (wind over a ridge)")
    func climbsUnderNegativeSpin() {
        let phi = heldOver { x, _ in 0.01 * x }
        let p = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(spin: -1), particle: p, env: env { _ in phi })
        #expect(p.velocity.x > 0)
    }

    @Test("a pure no-op with no accessor, and with no such channel")
    func noOpWithoutAChannel() {
        // the default path — Env.potential is nil, so registration cannot couple
        let p = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(), particle: p, env: env())
        #expect(p.velocity == Vec3.zero)

        // the channel was never registered, or has been removed
        let q = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(), particle: q, env: env { _ in nil })
        #expect(q.velocity == Vec3.zero)
    }

    @Test("a hostile channel cannot produce a non-finite or superluminal velocity")
    func hostileChannelIsClamped() {
        // NaN is the real exposure: a NaN velocity slips a `speed > c` test, so it is clamped where
        // the untrusted value enters the engine (at the raster), not downstream.
        let p = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(), particle: p,
                            env: env { _ in heldOver { x, _ in x > 400 ? Float.nan : 0.01 * x } })
        #expect(p.velocity.x.isFinite && p.velocity.y.isFinite)

        // a cliff has an unbounded gradient — which is why the c-cap ships with the force
        let q = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(strength: 1000), particle: q,
                            env: env { _ in heldOver { x, _ in x > 400 ? 1e9 : 0 } })
        #expect(simd_length(q.velocity) <= 12 + 1e-5)
    }

    @Test("flat ground produces no impulse at all")
    func flatGroundIsInert() {
        let p = Particle(position: Vec3(400, 300, 0))
        ReliefForce().apply(body: reliefBody(), particle: p, env: env { _ in heldOver { _, _ in 7 } })
        #expect(p.velocity == Vec3.zero)
    }

    @Test("a held grid NEVER steps — a declared terrain must not blur or decay")
    func heldGridNeverSteps() {
        let held = ScalarGridImpl(width: 320, height: 320, mode: .held)
        held.fillFrom { x, _ in 0.01 * x }
        let before = held.sample(at: Vec3(160, 160, 0))
        for _ in 0..<200 { held.step() }
        #expect(held.sample(at: Vec3(160, 160, 0)) == before)

        // the control: the same raster in the DEFAULT mode does erode, so the test is not vacuous
        let diffusing = ScalarGridImpl(width: 320, height: 320, mode: .diffuse)
        diffusing.fillFrom { x, _ in 0.01 * x }
        let d0 = diffusing.sample(at: Vec3(160, 160, 0))
        for _ in 0..<200 { diffusing.step() }
        #expect(diffusing.sample(at: Vec3(160, 160, 0)) != d0)
    }

    @Test("fillFrom reproduces the sampler at cell centres and clamps non-finite to 0")
    func fillFromIsExactAndSafe() {
        let g = ScalarGridImpl(width: 320, height: 320, mode: .held)
        g.fillFrom { x, y in (x == 64 && y == 64) ? Float.infinity : x + y }
        #expect(abs(g.sample(at: Vec3(96, 32, 0)) - 128) < 1e-2)
        #expect(g.sample(at: Vec3(64, 64, 0)).isFinite)
    }
}
