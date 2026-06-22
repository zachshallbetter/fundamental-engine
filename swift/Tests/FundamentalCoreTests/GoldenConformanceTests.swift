import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// Cross-plane conformance (#526) — the Swift engine must reproduce the JS engine's force math.
//
// `Fixtures/conformance-golden.json` is emitted by `packages/core/src/conformance/golden-emit.ts`:
// the canonical deterministic forces fired at a fan of probe particles, each with its frame-0
// velocity delta (`dv`) as computed by the f64 JS engine. Here the f32 Swift engine applies the
// same force to the same reconstructed inputs and must land on the same `dv`.
//
// Tolerance is a single force apply (no integration accumulation), so f32↔f64 drift is tiny: an
// absolute 2e-4 with a small relative term covers it while still catching a real formula divergence
// (a wrong coefficient, a missing falloff leg, a sign flip). When this fails, the JS and Swift ports
// of that force have diverged — fix the Swift force, never loosen the tolerance to hide it.

private struct GoldenFile: Decodable {
    let count: Int
    let cases: [GoldenCase]
}

private struct GoldenCase: Decodable {
    struct BodyJSON: Decodable { let strength, range, spin, ux, uy: Float; let on: Bool }
    struct EnvJSON: Decodable { let dx, dy, dz, dist, orbit: Float }
    struct Vel: Decodable { let vx, vy, vz: Float }
    struct DV: Decodable { let x, y, z: Float }
    let force: String
    let label: String
    let px, py: Float
    let body: BodyJSON
    let env: EnvJSON
    let particle: Vel
    let dv: DV
}

@Suite("CrossPlaneConformance")
struct CrossPlaneConformanceTests {

    private func loadGolden() throws -> GoldenFile {
        let url = try #require(
            Bundle.module.url(forResource: "conformance-golden", withExtension: "json", subdirectory: "Fixtures"),
            "conformance-golden.json missing — run `node packages/core/src/conformance/golden-emit.ts`"
        )
        return try JSONDecoder().decode(GoldenFile.self, from: Data(contentsOf: url))
    }

    @Test("every golden case is reproduced by the Swift force within tolerance")
    func parity() throws {
        let golden = try loadGolden()
        #expect(golden.cases.count == golden.count && golden.count > 0)

        let registry = Registry.standard().forces
        var checked = 0

        for c in golden.cases {
            let force = try #require(registry[c.force], "Swift registry has no force '\(c.force)'")

            // reconstruct the exact inputs the JS apply saw.
            let body = Body(
                tokens: [c.force],
                strength: c.body.strength,
                range: c.body.range,
                spin: c.body.spin,
                heading: Vec3(c.body.ux, c.body.uy, 0),
                box: Box(center: .zero, halfExtents: .zero) // body at the origin (matches the emitter)
            )
            body.isEngaged = c.body.on

            let p = Particle(position: Vec3(c.px, c.py, 0),
                             velocity: Vec3(c.particle.vx, c.particle.vy, c.particle.vz))

            let env = Env()
            env.vector = Vec3(c.env.dx, c.env.dy, c.env.dz) // JS e.dx/dy/dz == Swift e.vector
            env.dist = c.env.dist
            env.form = Formation(orbit: c.env.orbit)

            let v0 = p.velocity
            force.apply(body: body, particle: p, env: env)
            let dv = p.velocity - v0
            let want = Vec3(c.dv.x, c.dv.y, c.dv.z)

            let tol: Float = 2e-4 + 1e-3 * simd_length(want)
            let err = simd_length(dv - want)
            #expect(
                err <= tol,
                "\(c.force)/\(c.label) @(\(c.px),\(c.py)): Swift dv=(\(dv.x),\(dv.y),\(dv.z)) vs JS (\(want.x),\(want.y),\(want.z)) — err \(err) > tol \(tol)"
            )
            checked += 1
        }
        #expect(checked == golden.count)
    }
}
