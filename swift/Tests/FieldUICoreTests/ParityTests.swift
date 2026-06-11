import Foundation
import Testing
import simd
@testable import FieldUICore

// Tests for the full-parity port: grids, waves, flow, conditions, thermo, attention,
// causality, weights, temporal, reservoir, render-mode geometry, extended forces, recipes.

@Suite("ScalarGrid")
struct ScalarGridTests {

    @Test("deposit + sample round-trips through bilinear interpolation")
    func depositSample() {
        let g = ScalarGridImpl(width: 320, height: 320, mode: .diffuse)
        g.deposit(at: Vec3(160, 160, 0), amount: 10)
        #expect(g.sample(at: Vec3(160, 160, 0)) > 0)
        #expect(g.sample(at: Vec3(10, 10, 0)) == 0)
    }

    @Test("diffusion spreads and decays mass")
    func diffusionSpreads() {
        let g = ScalarGridImpl(width: 320, height: 320, mode: .diffuse)
        g.deposit(at: Vec3(160, 160, 0), amount: 100)
        let before = g.sample(at: Vec3(160, 160, 0))
        for _ in 0..<10 { g.step() }
        let centerAfter = g.sample(at: Vec3(160, 160, 0))
        let nearbyAfter = g.sample(at: Vec3(192, 160, 0))
        #expect(centerAfter < before)  // the peak decays
        #expect(nearbyAfter > 0)       // and spreads outward
    }

    @Test("wave mode carries a disturbance outward as an expanding ring")
    func waveExpands() {
        let g = ScalarGridImpl(width: 640, height: 640, mode: .wave)
        g.deposit(at: Vec3(320, 320, 0), amount: 100)
        for _ in 0..<20 { g.step() }
        // after 20 frames the front has moved off-centre: some |φ| lives away from the source
        var off: Float = 0
        for r in [64, 96, 128] {
            off = max(off, abs(g.sample(at: Vec3(320 + Float(r), 320, 0))))
        }
        #expect(off > 0)
    }

    @Test("gradient points up-slope")
    func gradientUpSlope() {
        let g = ScalarGridImpl(width: 320, height: 320, mode: .diffuse)
        g.deposit(at: Vec3(200, 160, 0), amount: 50)
        g.step() // blur once so the gradient is smooth
        let grad = g.gradient(at: Vec3(160, 160, 0))
        #expect(grad.x > 0) // uphill is toward the deposit at +x
        #expect(grad.z == 0) // planar lattice
    }
}

@Suite("Currents")
struct CurrentsTests {

    @Test("buildWaves makes five deterministic layers")
    func fiveLayers() {
        let waves = buildWaves(palette: [DEFAULT_ACCENT])
        #expect(waves.count == 5)
        #expect(waves[0].dir == 1 && waves[1].dir == -1) // alternating travel
        #expect(waves[4].depth == 1)
    }

    @Test("waveYat oscillates around the base line")
    func waveOscillates() {
        let w = buildWaves(palette: [DEFAULT_ACCENT])[0]
        let H: Float = 800
        let base = w.baseFrac * H
        var minY = Float.infinity
        var maxY = -Float.infinity
        // wave 0's spatial period is 2π/0.0012 ≈ 5236px — sweep a full cycle
        for x in stride(from: Float(0), to: 6000, by: 25) {
            let y = waveYat(w, x: x, time: 0, H: H)
            minY = min(minY, y)
            maxY = max(maxY, y)
        }
        #expect(minY < base && maxY > base)
        #expect(maxY - minY <= w.amp * 2 + 0.01)
    }

    @Test("a wave pull bends the line toward the engaged point")
    func wavePull() {
        let w = buildWaves(palette: [DEFAULT_ACCENT])[0]
        let H: Float = 800
        let pull = WavePull(x: 500, y: 100, k: 1)
        let unpulled = waveYat(w, x: 500, time: 0, H: H)
        let pulled = waveYat(w, x: 500, time: 0, H: H, pull: pull)
        #expect(pulled < unpulled) // bent up toward y=100
    }

    @Test("integrator wave drift moves matter near a line")
    func waveDrift() {
        let waves = buildWaves(palette: [DEFAULT_ACCENT])
        let store = FieldStore()
        let H: Float = 600
        let w = waves[0]
        let y0 = waveYat(w, x: 400, time: 0, H: H)
        let p = store.add(Particle(position: Vec3(400, y0 + 10, 0)))
        let env = Env()
        env.volume = Vec3(800, H, 0)
        store.reindex()
        step(StepInput(store: store, bodies: [], env: env, forces: [:], waves: waves))
        #expect(p.velocity.x != 0) // the current carried it
    }
}

@Suite("Flow")
struct FlowTests {

    @Test("flowBias pulls toward the focus with linear falloff, zero outside")
    func bias() {
        let f = makeFlowFocus(at: Vec3(100, 0, 0))
        let near = flowBias(at: Vec3(50, 0, 0), focus: f)
        let far = flowBias(at: Vec3(-300, 0, 0), focus: f) // dist 400 > 360
        #expect(near.x > 0)
        #expect(far == .zero)
    }

    @Test("defaults: strength 1, radius 360; zero radius falls back")
    func defaults() {
        let f = makeFlowFocus(at: .zero, radius: 0)
        #expect(f.strength == 1)
        #expect(f.radius == 360)
    }
}

@Suite("Conditions")
struct ConditionTests {

    @Test("the six built-in gates evaluate correctly")
    func gates() {
        let reg = builtinConditions()
        let b = Body(tokens: ["attract"])
        let env = Env()

        let fast = Particle(velocity: Vec3(1, 1, 0))
        let slow = Particle(velocity: Vec3(0.1, 0, 0))
        #expect(reg["fast"]!(b, fast, env))
        #expect(reg["slow"]!(b, slow, env))

        let hot = Particle(heat: 0.5)
        let cool = Particle(heat: 0.01)
        #expect(reg["hot"]!(b, hot, env))
        #expect(reg["cool"]!(b, cool, env))

        b.isEngaged = true
        #expect(reg["active"]!(b, hot, env))

        env.scrollV = 1
        #expect(reg["scrolling"]!(b, hot, env))
    }
}

@Suite("Thermo")
struct ThermoTests {

    @Test("an empty sample reads as a quiet region")
    func quiet() {
        let m = thermoMetrics(nil)
        #expect(m.entropy == 0 && m.coherence == 1 && m.temperature == 0)
    }

    @Test("aligned velocities → low entropy; dispersed → high")
    func alignment() {
        var aligned = Body.Thermo()
        aligned.n = 4
        aligned.sv = Vec3(8, 0, 0)  // four velocities of (2,0)
        aligned.ss = 8
        aligned.ss2 = 16
        let ma = thermoMetrics(aligned)
        #expect(ma.entropy < 0.01)

        var dispersed = Body.Thermo()
        dispersed.n = 4
        dispersed.sv = .zero        // velocities cancel
        dispersed.ss = 8
        dispersed.ss2 = 16
        let md = thermoMetrics(dispersed)
        #expect(md.entropy > 0.9)
        #expect(abs(md.coherence - (1 - md.entropy)) < 0.0001)
    }
}

@Suite("Attention")
struct AttentionTests {

    @Test("rest-neutral: all multipliers exactly 1 when nothing is engaged")
    func restNeutral() {
        let muls = attentionMuls([AttnInput(strength: 1, on: false), AttnInput(strength: 2, on: false)])
        #expect(muls.allSatisfy { $0 == 1 })
    }

    @Test("engaging one body boosts it and dims the others, conserving ΣS·mul")
    func conserved() {
        let inputs = [AttnInput(strength: 1, on: true), AttnInput(strength: 1, on: false), AttnInput(strength: 1, on: false)]
        let muls = attentionMuls(inputs)
        #expect(muls[0] > 1)
        #expect(muls[1] < 1 && muls[2] < 1)
        let total = zip(inputs, muls).reduce(Float(0)) { $0 + $1.0.strength * $1.1 }
        #expect(abs(total - 3) < 0.001) // Σ Sᵢ·mulᵢ = Σ Sᵢ
    }

    @Test("allocateAttention water-fills to the budget with caps and pins")
    func waterFill() {
        let items = [AttnAllocItem(urgency: 3), AttnAllocItem(urgency: 1), AttnAllocItem(urgency: 0, pinned: true)]
        let w = allocateAttention(items, budget: 2)
        #expect(w[2] == 1)                          // pinned takes cap off the top
        #expect(abs(w[0] + w[1] - 1) < 0.001)       // the rest splits the remaining 1
        #expect(w[0] > w[1])                        // by urgency
    }
}

@Suite("Causality")
struct CausalityTests {

    @Test("spillover conserves: deltas sum to zero")
    func conserved() {
        let bodies = [
            SpillBody(d: 0.9, center: Vec3(0, 0, 0)),     // saturated — spills
            SpillBody(d: 0.1, center: Vec3(100, 0, 0)),   // близко — receives
            SpillBody(d: 0.1, center: Vec3(200, 0, 0)),
        ]
        let deltas = spillover(bodies)
        #expect(abs(deltas.reduce(0, +)) < 0.0001)
        #expect(deltas[0] < 0)              // the saturated body donates
        #expect(deltas[1] > deltas[2])      // the nearer neighbour receives more
    }

    @Test("below threshold nothing spills")
    func belowThreshold() {
        let deltas = spillover([
            SpillBody(d: 0.3, center: .zero),
            SpillBody(d: 0.3, center: Vec3(50, 0, 0)),
        ])
        #expect(deltas.allSatisfy { $0 == 0 })
    }
}

@Suite("Weights")
struct WeightTests {

    @Test("logNormalize: zero stays zero, max reads one, tails compress")
    func logNorm() {
        #expect(logNormalize(0, max: 100) == 0)
        #expect(abs(logNormalize(100, max: 100) - 1) < 0.0001)
        let mid = logNormalize(10, max: 100)
        #expect(mid > 0.1 && mid < 1) // compressed, not linear (10/100 = 0.1)
    }

    @Test("weightToStrength endpoints are exact")
    func strengthMap() {
        #expect(weightToStrength(0) == 0.4)
        #expect(weightToStrength(1) == 2.0)
        #expect(weightToStrength(Float.nan) == 0.4) // NaN reads as light, never NaN
    }

    @Test("logNormalizeBetween stretches the set's own range")
    func between() {
        #expect(logNormalizeBetween(10, min: 10, max: 1000) == 0)
        #expect(abs(logNormalizeBetween(1000, min: 10, max: 1000) - 1) < 0.0001)
        #expect(logNormalizeBetween(5, min: 5, max: 5) == 1) // degenerate set reads heavy
    }
}

@Suite("Temporal")
struct TemporalTests {

    @Test("imminence: 1 at the moment, 0 at the horizon")
    func imminenceShape() {
        let now: Double = 1_000_000
        #expect(imminence(atMs: now, nowMs: now, horizonMs: DAY_MS) == 1)
        #expect(imminence(atMs: now - 1, nowMs: now, horizonMs: DAY_MS) == 1) // passed
        #expect(abs(imminence(atMs: now + DAY_MS, nowMs: now, horizonMs: DAY_MS)) < 0.0001)
    }

    @Test("freshness: exactly 0.5 one half-life later")
    func freshnessHalfLife() {
        let now: Double = 5_000_000
        #expect(freshness(atMs: now, nowMs: now, halfLifeMs: HOUR_MS) == 1)
        #expect(abs(freshness(atMs: now - HOUR_MS, nowMs: now, halfLifeMs: HOUR_MS) - 0.5) < 0.0001)
    }

    @Test("retention: a at zero elapsed; stronger anchors decay slower")
    func retentionShape() {
        #expect(abs(retention(anchor: 0.8, sinceMs: 0) - 0.8) < 0.0001)
        let weak = retention(anchor: 0.2, sinceMs: 30 * DAY_MS) / 0.2
        let strong = retention(anchor: 1.0, sinceMs: 30 * DAY_MS) / 1.0
        #expect(strong > weak) // τ grows with anchor strength
    }

    @Test("phase wraps sign-safely and never reads 1")
    func phaseWrap() {
        #expect(phase(nowMs: 0, periodMs: 100) == 0)
        #expect(abs(phase(nowMs: 150, periodMs: 100) - 0.5) < 0.0001)
        #expect(abs(phase(nowMs: -50, periodMs: 100) - 0.5) < 0.0001) // before the offset
    }
}

@Suite("RenderModeGeometry")
struct RenderModeTests {

    @Test("linkAlpha fades linearly and is zero at range")
    func links() {
        #expect(linkAlpha(d: 0, r: 100) == 0.12)
        #expect(abs(linkAlpha(d: 50, r: 100) - 0.06) < 0.0001)
        #expect(linkAlpha(d: 100, r: 100) == 0)
    }

    @Test("marchingCell: empty and full cells yield no segments; edges yield one")
    func marching() {
        #expect(marchingCell(tl: 0, tr: 0, br: 0, bl: 0, level: 0.5).isEmpty)
        #expect(marchingCell(tl: 1, tr: 1, br: 1, bl: 1, level: 0.5).isEmpty)
        #expect(marchingCell(tl: 1, tr: 0, br: 0, bl: 0, level: 0.5).count == 1)
        #expect(marchingCell(tl: 1, tr: 0, br: 1, bl: 0, level: 0.5).count == 2) // saddle
    }

    @Test("voronoiWalls separate differing owners only")
    func voronoi() {
        // 2×2 grid, left column owner 0, right column owner 1 → one vertical wall per row
        let walls = voronoiWalls(owners: [0, 1, 0, 1], cols: 2, rows: 2)
        #expect(walls.filter { $0.x1 == $0.x2 }.count == 2)
    }

    @Test("splatDensity deposits a smooth kernel bounded by radius")
    func splat() {
        var grid = [Float](repeating: 0, count: 100)
        splatDensity(grid: &grid, cols: 10, rows: 10, step: 10, px: 50, py: 50, radius: 25)
        #expect(grid[5 * 10 + 5] > 0)   // centre node
        #expect(grid[0] == 0)           // far corner untouched
    }
}

@Suite("ExtendedForces")
struct ExtendedForceTests {

    private func env(for b: Body, p: Particle) -> Env {
        let e = Env()
        e.volume = Vec3(800, 600, 0)
        e.vector = b.center - p.position
        e.dist = max(simd_length(e.vector), 1)
        return e
    }

    @Test("lens rotates velocity preserving speed exactly")
    func lens() {
        let b = Body(tokens: ["lens"], strength: 0.8, range: 200,
                     box: Box(center: Vec3(400, 300, 0), halfExtents: Vec3(40, 20, 0)))
        let p = Particle(position: Vec3(450, 300, 0), velocity: Vec3(3, 4, 0))
        let before = simd_length(p.velocity)
        LensForce().apply(body: b, particle: p, env: env(for: b, p: p))
        #expect(abs(simd_length(p.velocity) - before) < 0.0001)
        #expect(p.velocity != Vec3(3, 4, 0))
    }

    @Test("gate reflects wrong-way crossers, passes right-way")
    func gate() {
        let b = Body(tokens: ["gate"], heading: Vec3(1, 0, 0),
                     box: Box(center: Vec3(400, 300, 0), halfExtents: Vec3(40, 20, 0)))
        let wrong = Particle(position: Vec3(400, 300, 0), velocity: Vec3(-2, 0, 0))
        GateForce().apply(body: b, particle: wrong, env: env(for: b, p: wrong))
        #expect(wrong.velocity.x > 0) // reflected to travel with n

        let right = Particle(position: Vec3(400, 300, 0), velocity: Vec3(2, 0, 0))
        GateForce().apply(body: b, particle: right, env: env(for: b, p: right))
        #expect(right.velocity.x == 2) // untouched
    }

    @Test("buoyancy lifts hot/large matter, sinks dense matter")
    func buoyancy() {
        let b = Body(tokens: ["buoyancy"], strength: 1, range: 0,
                     box: Box(center: Vec3(400, 300, 0), halfExtents: .zero))
        let hot = Particle(position: Vec3(100, 100, 0), heat: 1, size: 2)
        BuoyancyForce().apply(body: b, particle: hot, env: env(for: b, p: hot))
        #expect(hot.velocity.y < 0) // rises (−y is up)

        let dense = Particle(position: Vec3(100, 100, 0), heat: 0, size: 0.5)
        BuoyancyForce().apply(body: b, particle: dense, env: env(for: b, p: dense))
        #expect(dense.velocity.y > 0) // settles
    }

    @Test("resonate pulses sibling strength over time")
    func resonate() {
        let b = Body(tokens: ["resonate", "attract"], spin: 1)
        let p = Particle()
        let e = env(for: b, p: p)
        e.t = Float.pi / (2 * 3) // sin(ω·t) = sin(π/2) = 1 with ω=3
        let m = ResonateForce().modify(body: b, particle: p, env: e)
        #expect(abs((m?.strength ?? 0) - 2) < 0.001) // 1 + sin = 2 at the crest
    }

    @Test("spotlight gates matter outside the heading cone")
    func spotlight() {
        let b = Body(tokens: ["spotlight", "stream"], heading: Vec3(1, 0, 0),
                     box: Box(center: Vec3(400, 300, 0), halfExtents: .zero))
        // particle to the +x side: inside the cone (body→particle along heading)
        let inside = Particle(position: Vec3(500, 300, 0))
        let mi = SpotlightForce().modify(body: b, particle: inside, env: env(for: b, p: inside))
        #expect(mi?.gate == false)
        // particle to the −x side: outside
        let outside = Particle(position: Vec3(300, 300, 0))
        let mo = SpotlightForce().modify(body: b, particle: outside, env: env(for: b, p: outside))
        #expect(mo?.gate == true)
    }

    @Test("warp relocates matter to the paired throat, conserving speed")
    func warp() {
        let a = Body(tokens: ["warp"], box: Box(center: Vec3(100, 100, 0), halfExtents: Vec3(20, 20, 0)))
        a.absorbR = 30
        let target = Vec3(700, 500, 0)
        a.warpTarget = target
        a.warpHas = true
        let p = Particle(position: Vec3(110, 100, 0), velocity: Vec3(1, 2, 0))
        let speed = simd_length(p.velocity)
        WarpForce().apply(body: a, particle: p, env: env(for: a, p: p))
        #expect(simd_distance(p.position, target) < 50) // emerged at the pair
        #expect(abs(simd_length(p.velocity) - speed) < 0.0001) // momentum carried through
    }

    @Test("spawn emits budgeted mortal matter via the source hook")
    func spawnBudget() {
        let b = Body(tokens: ["spawn"], strength: 2, heading: Vec3(0, -1, 0),
                     box: Box(center: Vec3(400, 300, 0), halfExtents: .zero))
        b.isEngaged = true
        b.life = 60
        var spawned: [Particle] = []
        let e = Env()
        e.spawn = { spawned.append($0) }
        SpawnForce().source(body: b, env: e)
        #expect(!spawned.isEmpty)
        #expect(spawned.allSatisfy { $0.age == 60 }) // mortal, budgeted by data-life
    }

    @Test("pigment stains overlapping matter with the body tint")
    func pigment() {
        let b = Body(tokens: ["pigment"], range: 100,
                     box: Box(center: Vec3(400, 300, 0), halfExtents: .zero))
        b.tint = "#ff0000"
        let p = Particle(position: Vec3(410, 300, 0))
        PigmentForce().apply(body: b, particle: p, env: env(for: b, p: p))
        #expect(p.color == "#ff0000")
    }

    @Test("wind is divergence-free curl noise — deterministic")
    func wind() {
        let a = curlNoise(x: 100, y: 100, t: 1, s: 0.01)
        let b = curlNoise(x: 100, y: 100, t: 1, s: 0.01)
        #expect(a == b) // closed-form, no RNG
        #expect(a.z == 0)
    }
}

@Suite("Reservoir")
struct ReservoirTests {

    @Test("induceCharges polarizes neutral matter by side, never overwrites")
    func induction() {
        let b = Body(tokens: ["magnetism"], range: 200,
                     box: Box(center: Vec3(400, 300, 0), halfExtents: Vec3(40, 20, 0)))
        b.isVisible = true
        let left = Particle(position: Vec3(300, 300, 0))
        let right = Particle(position: Vec3(500, 300, 0))
        let signed = Particle(position: Vec3(390, 300, 0))
        signed.charge = -1
        induceCharges(bodies: [b], particles: [left, right, signed])
        #expect(left.charge == 1)    // body is to the +x of it → dx >= 0
        #expect(right.charge == -1)
        #expect(signed.charge == -1) // already signed — untouched
    }

    @Test("tearBoundNear conserves count: bound out, free in")
    func tearConserves() {
        let waves = buildWaves(palette: [DEFAULT_ACCENT])
        var bound = buildBound(waveCount: waves.count, density: 1) { 0.5 }
        let total = bound.count
        var spawned = 0
        // tear at wave 0's line position for progress 0.5 in an 800×600 field
        let w = waves[0]
        let x: Float = 0.5 * 800
        let y = waveYat(w, x: x, time: 0, H: 600)
        tearBoundNear(bound: &bound, waves: waves, center: Vec3(x, y, 0), radius: 200,
                      W: 800, H: 600, time: 0) { _ in spawned += 1 }
        #expect(spawned > 0)
        #expect(bound.count + spawned == total) // conserved exchange
    }
}

@Suite("Recipes")
struct RecipeTests {

    @Test("the locked catalog decodes: 64 recipes, 4 tiers × 16")
    func catalogLoads() {
        #expect(FieldRecipes.all.count == 64)
        #expect(FieldRecipes.recipes(tier: .core).count == 16)
        #expect(FieldRecipes.recipes(tier: .applied).count == 16)
        #expect(FieldRecipes.recipes(tier: .systems).count == 16)
        #expect(FieldRecipes.recipes(tier: .operational).count == 16)
    }

    @Test("every recipe in the canon validates against the standard registry")
    func allValid() {
        let reg = Registry.standard()
        for r in FieldRecipes.all {
            let problems = validateRecipe(r, against: reg)
            #expect(problems.isEmpty, "recipe \(r.id): \(problems.map { "\($0.path): \($0.issue)" }.joined(separator: "; "))")
        }
    }

    @Test("compileRecipe preserves the lane split and builds working bodies")
    func compile() {
        let r = FieldRecipes.recipe(id: "priority-well")!
        let compiled = compileRecipe(r)
        #expect(compiled.bodies.count == r.bodies.count)
        #expect(compiled.bodies[0].tokens == ["attract"])
        #expect(compiled.feedback.contains { $0.metric == "density" && $0.variable == "field-density" })
        let body = compiled.bodies[0].makeBody()
        #expect(body.strength == 1.2)
        #expect(body.range == 320)
        #expect(body.feedback)
    }

    @Test("primitivesOf derives distinct tokens in first-seen order")
    func primitives() {
        let bodies = [
            BodyRecipe(body: "attract gravity", strength: nil, range: nil, spin: nil, angle: nil, feedback: nil, scope: nil),
            BodyRecipe(body: "gravity sink", strength: nil, range: nil, spin: nil, angle: nil, feedback: nil, scope: nil),
        ]
        #expect(primitivesOf(bodies) == ["attract", "gravity", "sink"])
    }
}
