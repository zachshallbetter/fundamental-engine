import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// Performance model — the deterministic, machine-independent half (#324-aware).
//
// Wall-clock budgets are deliberately NOT gated in CI: the field is fill-rate-bound, headless
// rasterization exaggerates fill, and CI runners vary — inventing a frame-time budget is the mistake
// #324 was blocked on (real budgets need on-hardware measurement). What CI *can* gate, deterministically
// and identically on every machine, is the engine's *work staying bounded*: a heavy field run for a long
// time must conserve its particle count (no leak, no unbounded spawn), keep every value finite (no NaN/Inf
// blowup), and hold velocity/heat in range. Those are the perf-bug classes that actually ship — a runaway
// allocation or a divergent integrator — and they're caught here without a clock.
//
// Wall-clock *measurement* lives in `swift run FieldLabSnapshots --bench` (Bench.standardSweep), which
// reports sim/draw ms for reasoning about a change. Reported, not gated.

@Suite("PerfRegression")
struct PerfRegressionTests {

    /// A deterministic LCG so the scatter is identical on every run/machine (no Math.random).
    private struct LCG {
        var s: UInt32
        mutating func next() -> Float { s = s &* 1664525 &+ 1013904223; return Float(s >> 8) / Float(1 << 24) }
    }

    @Test("a heavy field run for 600 frames stays conserved, finite, and bounded")
    func heavyRunStaysBounded() {
        let W: Float = 1280, H: Float = 800
        let store = FieldStore()
        var rng = LCG(s: 0x9E3779B9)
        let N = 1200
        for _ in 0..<N {
            let p = Particle(
                position: Vec3(rng.next() * W, rng.next() * H, 0),
                velocity: Vec3((rng.next() - 0.5) * 2, (rng.next() - 0.5) * 2, 0)
            )
            _ = store.add(p)
        }
        store.reindex()

        // a mixed heavy load: a long-range attractor, an off-centre swirl, and a capturing sink —
        // all count-conserving (no source/spawn), so conservation is an exact invariant.
        func body(_ tokens: [String], _ cx: Float, _ cy: Float, range: Float, spin: Float = 1) -> Body {
            Body(tokens: tokens, strength: 1, range: range, absorbR: 60, capacity: 100, spin: spin,
                 box: Box(center: Vec3(cx, cy, 0), halfExtents: Vec3(20, 20, 0)))
        }
        let bodies = [
            body(["attract"], 640, 400, range: 500),
            body(["swirl"], 300, 300, range: 300),
            body(["sink"], 980, 560, range: 220),
        ]
        for b in bodies { b.isVisible = true }

        let reg = Registry.standard()
        let env = Env()
        env.volume = Vec3(W, H, 0)
        env.dt = 1
        env.form = .neutral

        for frame in 0..<600 {
            env.frameN = frame
            env.t = Float(frame) / 60
            env.neighbors = { p, r in store.neighbors(p, r: r) }
            store.reindex()
            step(StepInput(store: store, bodies: bodies, env: env,
                           forces: reg.forces, conditions: reg.conditions))
        }

        // 1 · conservation — the one strong invariant. A sink captures (holds) matter but never
        //     removes it; with no source/spawn body the count must be exactly what we seeded.
        #expect(store.size == N, "particle count drifted: \(store.size) != \(N) — a leak or unbounded spawn")

        // 2 · finiteness + bounded state — a divergent integrator blows up to NaN/Inf or to absurd
        //     magnitudes. Every particle must stay finite, in-bounds-velocity, and heat ∈ [0,1].
        var maxSpeed: Float = 0
        for p in store.particles {
            #expect(p.position.x.isFinite && p.position.y.isFinite && p.position.z.isFinite, "non-finite position")
            #expect(p.velocity.x.isFinite && p.velocity.y.isFinite && p.velocity.z.isFinite, "non-finite velocity")
            #expect(p.heat >= 0 && p.heat <= 1.0001, "heat out of range: \(p.heat)")
            maxSpeed = max(maxSpeed, simd_length(p.velocity))
        }
        // a generous ceiling: any healthy run settles well under this; a blowup screams past it.
        #expect(maxSpeed < 100, "velocity unbounded: max speed \(maxSpeed) — integrator divergence")
    }
}
