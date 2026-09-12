import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// MARK: - Render-probe purity (#1162, the Swift half of #1155)
//
// Drawing a diagnostic must never move the simulation. `forceAt` measures the field with a
// fictitious test particle; it used to run every body's real `apply()` against the CALLER'S LIVE
// ENV, so:
//
//   - `sink.apply` advanced a real body's accretion budget (`b.accreted += 1`) and could fire the
//     live `e.supernova(b)` — a body detonating because the field was DRAWN;
//   - `diffuse`/`memory` wore the real scalar grids and `wall` threw sparks into the live field;
//   - the probe drew from the simulation's seeded `rng`, so drawing advanced the record/replay
//     stream and the same point read a different vector depending on what had been sampled first.
//
// Swift's exposure was strictly WORSE than the JS engine's. JS shares one module-level probe
// particle whose `cap` was never cleared, so `sink`'s own `if (p.cap || …) return` guard
// short-circuited for the life of the process and a body was over-accreted exactly once — the leak
// was self-limiting BY ACCIDENT. Swift builds a fresh `Particle` per call (`forceAt`, line 1), so
// `p.cap` is always nil and that guard never fires: every probe point inside `absorbR` accreted, on
// every sample of every frame. Hundreds of increments a second, racing a real body to `capacity`.
//
// The probe now runs under its OWN `Env` (``makeProbeEnv(mirroring:)``) — inert `spark`/
// `supernova`/`spawn`, read-through write-dropping grids, its own per-sample `seededRng` — plus the
// `Env.isProbe` marker, which `sink` checks before accreting (an inert env cannot stop a DIRECT
// body write). The drawn vectors are unchanged for every non-mutating force.

@Suite("Render-probe purity (#1162)")
struct ProbePurityTests {

    // ── the render loop's own grid walk ──────────────────────────────────────────────────────────

    static let W: Float = 800
    static let H: Float = 600
    static let GRID: Float = 46 // the streamlines / flow grid pitch

    static let registry: ForceRegistry = {
        var r: ForceRegistry = [:]
        for f in coreForces() + naturalForces() + extendedForces() { r[f.token] = f }
        return r
    }()

    static func body(_ tokens: [String], _ cx: Float, _ cy: Float,
                     strength: Float = 1.5, range: Float = 240,
                     absorbR: Float = 120, capacity: Float = 60) -> Body {
        let b = Body(tokens: tokens, strength: strength, range: range, absorbR: absorbR,
                     capacity: capacity, spin: 1, heading: Vec3(1, 0, 0),
                     box: Box(center: Vec3(cx, cy, 0), halfExtents: Vec3(30, 14, 0)))
        b.isVisible = true // forceAt culls invisible bodies
        return b
    }

    /// A LIVE env — real services, exactly what every `forceAt` call site passes in.
    static func liveEnv() -> Env {
        let e = Env()
        e.volume = Vec3(W, H, 0)
        e.dt = 1
        return e
    }

    /// One frame of the streamlines underlay: the grid walk the renderers perform verbatim.
    @discardableResult
    static func drawOneFrame(_ bodies: [Body], _ env: Env) -> Int {
        var samples = 0
        var gx = GRID / 2
        while gx < W {
            var gy = GRID / 2
            while gy < H {
                _ = forceAt(bodies: bodies, forces: registry, env: env, at: Vec3(gx, gy, 0))
                samples += 1
                gy += GRID
            }
            gx += GRID
        }
        return samples
    }

    // ── 1. the accretion budget is UNCHANGED, not merely "incremented once" ───────────────────────

    @Test("drawing streamlines over a sink leaves its accretion untouched, frame after frame")
    func drawingDoesNotAccrete() {
        let sink = Self.body(["sink"], Self.W / 2, Self.H / 2, absorbR: 150, capacity: 4)
        var supernovas = 0
        var sparks = 0
        let env = Self.liveEnv()
        env.supernova = { _ in supernovas += 1 }
        env.spark = { _, _, _ in sparks += 1 }

        // non-vacuity: the walk really does put probe points deep inside the absorb radius, so a
        // pass here cannot mean "the probe never met the sink".
        var inside = 0
        var gx = Self.GRID / 2
        while gx < Self.W {
            var gy = Self.GRID / 2
            while gy < Self.H {
                if simd_distance(Vec3(gx, gy, 0), sink.center) < sink.absorbR { inside += 1 }
                gy += Self.GRID
            }
            gx += Self.GRID
        }
        #expect(inside > 0, "the grid walk samples inside absorbR — the assertions below are real")

        for frame in 0..<12 {
            env.frameN = frame
            env.t = Float(frame) / 60
            Self.drawOneFrame([sink], env)
            // asserted EVERY frame: a leak that is self-limiting by accident (JS) and a leak that
            // accretes on every sample (Swift) both fail here, and they fail differently.
            #expect(sink.accreted == 0,
                    "frame \(frame): drawing must not accrete (accreted = \(sink.accreted))")
        }
        #expect(supernovas == 0, "drawing must never detonate a real body")
        #expect(sparks == 0, "drawing must never throw sparks into the live field")
    }

    // ── 2. a sample is a function of its point, not of the sampling history ───────────────────────

    @Test("two probe samples at the same point agree, whatever was sampled between them")
    func sampleIsHistoryIndependent() {
        // `jet` at its nozzle relaunches the probe along a randomly jittered heading drawn from
        // `e.rng`. Threading the simulation's live env into the probe made a reading depend on how
        // many samples had been taken before it: the same point read a different vector every time
        // it was drawn. (A `sink` sits in the field too, so the in-between sweep also exercises the
        // accretion path — that its budget stays put is test 1.)
        let nozzle = Self.body(["jet"], 200, 150, range: 300)
        let sink = Self.body(["sink"], 600, 450, absorbR: 150, capacity: 1_000_000)
        let bodies = [nozzle, sink]
        let env = Self.liveEnv()
        env.rng = seededRng(7)

        let at = Vec3(210, 150, 0) // inside the nozzle (dist < 24)
        let first = forceAt(bodies: bodies, forces: Self.registry, env: env, at: at)
        #expect(simd_length(first) > 0, "the probe point reads a live jet relaunch")

        // …sample the rest of the field in between — a full frame's grid walk, plus more nozzle points.
        Self.drawOneFrame(bodies, env)
        _ = forceAt(bodies: bodies, forces: Self.registry, env: env, at: Vec3(196, 152, 0))
        _ = forceAt(bodies: bodies, forces: Self.registry, env: env, at: Vec3(204, 144, 0))

        let second = forceAt(bodies: bodies, forces: Self.registry, env: env, at: at)
        #expect(second == first,
                "the same point must read the same vector after any other sampling (\(first) vs \(second))")
    }

    // ── 3. drawing does not consume the simulation's seeded rng (record/replay determinism) ───────

    @Test("drawing does not draw from the simulation rng stream")
    func drawingDoesNotConsumeTheSeededStream() {
        let jet = Self.body(["jet"], Self.W / 2, Self.H / 2, range: 900) // jet jitters through e.rng
        var draws = 0
        let env = Self.liveEnv()
        env.rng = { draws += 1; return 0.5 }

        Self.drawOneFrame([jet], env)

        #expect(draws == 0, "a diagnostic must not advance the seeded stream (drew \(draws) values)")
    }
}
