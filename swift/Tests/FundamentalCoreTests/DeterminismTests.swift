import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// MARK: - The determinism seam (#974)
//
// The Swift port of the JS injectable-rng contract (#371, packages/core/src/record/rng.ts +
// record.test.ts): `seededRng` is deterministic and engine-independent for a given seed, and every
// engine random draw routes through `Env.rng` — never a private generator — so a seeded run is
// reproducible. The whole-run engine fingerprint lives in FundamentalVanillaTests/DeterminismTests
// (it needs the FieldEngine loop); these pin the core seam itself.

@Suite("Determinism seam (#974)")
struct DeterminismTests {

    @Test("seededRng is deterministic and engine-independent for a given seed")
    func seededRngDeterminism() {
        let a = seededRng(42)
        let b = seededRng(42)
        let seqA = (0..<16).map { _ in a() }
        let seqB = (0..<16).map { _ in b() }
        #expect(seqA == seqB, "same seed → identical stream")
        for v in seqA { #expect(v >= 0 && v < 1, "values are in [0, 1)") }

        let c = seededRng(43)
        let seqC = (0..<16).map { _ in c() }
        #expect(seqA != seqC, "a different seed diverges")
    }

    @Test("thermal draws its Box–Muller uniforms from Env.rng")
    func thermalDrawsFromEnvRng() {
        var draws = 0
        let env = Env()
        env.rng = { draws += 1; return 0.5 }
        env.dist = 10
        env.volume = Vec3(800, 600, 0)
        let b = Body(tokens: ["thermal"], strength: 2, range: 100,
                     box: Box(center: Vec3(0, 0, 0), halfExtents: Vec3(40, 20, 0)))
        ThermalForce().apply(body: b, particle: Particle(), env: env)
        #expect(draws == 2, "a planar thermal kick draws exactly its two Box–Muller uniforms from Env.rng")
    }

    @Test("the jet nozzle cone draws from Env.rng")
    func jetDrawsFromEnvRng() {
        var draws = 0
        let env = Env()
        env.rng = { draws += 1; return 0.5 }
        env.dist = 10 // inside the nozzle (< 24)
        let b = Body(tokens: ["jet"], strength: 1, range: 200,
                     box: Box(center: Vec3(0, 0, 0), halfExtents: Vec3(40, 20, 0)))
        JetForce().apply(body: b, particle: Particle(), env: env)
        #expect(draws == 1, "the jet's nozzle-cone spread draws from Env.rng")
    }

    @Test("the integrator's brownian wander is exactly reproducible under a seeded Env.rng")
    func wanderReproducible() {
        func run(seed: UInt32) -> [Float] {
            let env = Env()
            env.rng = seededRng(seed)
            env.volume = Vec3(800, 600, 0)
            env.form = Formation(wander: 1.0)
            env.frameN = 40 // the periodic brownian kick fires on frameN % 40 == 0
            let p = Particle(position: Vec3(100, 100, 0), velocity: Vec3(0.2, -0.1, 0))
            step(StepInput(store: singleParticleStore(p), bodies: [], env: env,
                           forces: Registry.standard().forces, conditions: [:]))
            return [p.position.x, p.position.y, p.velocity.x, p.velocity.y]
        }
        #expect(run(seed: 7) == run(seed: 7), "same seed → identical wander kick")
        #expect(run(seed: 7) != run(seed: 8), "a different seed diverges")
    }

    private func singleParticleStore(_ p: Particle) -> FieldStore {
        let s = FieldStore()
        s.add(p)
        return s
    }
}
