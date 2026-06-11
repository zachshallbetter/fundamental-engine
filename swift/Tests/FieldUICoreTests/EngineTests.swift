import Foundation
import Testing
import simd
@testable import FieldUICore

// MARK: - Helpers

private func makeEnv(volume: Vec3 = Vec3(800, 600, 0)) -> Env {
    let env = Env()
    env.volume = volume
    return env
}

private func makeBody(_ tokens: [String], at center: Vec3 = Vec3(400, 300, 0),
                      strength: Float = 1, range: Float = 200) -> Body {
    let b = Body(tokens: tokens, strength: strength, range: range,
                 box: Box(center: center, halfExtents: Vec3(40, 20, 0)))
    b.isVisible = true
    return b
}

private func stepOnce(store: FieldStore, bodies: [Body], env: Env,
                      forces: ForceRegistry = Registry.standard().forces) {
    store.reindex()
    step(StepInput(store: store, bodies: bodies, env: env, forces: forces))
}

// MARK: - FieldStore

@Suite("FieldStore")
struct FieldStoreTests {

    @Test("add and size")
    func addSize() {
        let store = FieldStore()
        store.add(Particle(position: Vec3(1, 2, 0)))
        store.add(Particle(position: Vec3(3, 4, 0)))
        #expect(store.size == 2)
    }

    @Test("swap-remove keeps the pool consistent")
    func swapRemove() {
        let store = FieldStore()
        let a = store.add(Particle())
        let b = store.add(Particle())
        let c = store.add(Particle())
        store.remove(b)
        #expect(store.size == 2)
        #expect(store.particles.contains { $0 === a })
        #expect(store.particles.contains { $0 === c })
        #expect(!store.particles.contains { $0 === b })
    }

    @Test("neighbors excludes the query particle and respects radius")
    func neighbors() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(100, 100, 0)))
        let near = store.add(Particle(position: Vec3(110, 100, 0)))
        store.add(Particle(position: Vec3(500, 500, 0)))   // far
        store.reindex()
        let found = store.neighbors(p, r: 50)
        #expect(found.count == 1)
        #expect(found[0] === near)
    }

    @Test("near(point:) works for non-particle origins")
    func nearPoint() {
        let store = FieldStore()
        store.add(Particle(position: Vec3(10, 10, 0)))
        store.reindex()
        #expect(store.near(Vec3(12, 10, 0), r: 5).count == 1)
        #expect(store.near(Vec3(200, 200, 0), r: 5).isEmpty)
    }

    @Test("3D: neighbors found across z")
    func neighbors3D() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(100, 100, 100)))
        store.add(Particle(position: Vec3(100, 100, 120)))   // 20 away in z
        store.add(Particle(position: Vec3(100, 100, 300)))   // 200 away in z
        store.reindex()
        #expect(store.neighbors(p, r: 50).count == 1)
    }
}

// MARK: - Integrator

@Suite("Integrator")
struct IntegratorTests {

    @Test("friction damps velocity each tick")
    func friction() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(400, 300, 0), velocity: Vec3(10, 0, 0)))
        let env = makeEnv()
        stepOnce(store: store, bodies: [], env: env)
        // integrate then damp: v = 10 × FRICTION
        #expect(abs(p.velocity.x - 10 * FRICTION) < 0.001)
        #expect(abs(p.position.x - 410) < 0.001)
    }

    @Test("reduced motion (dt = 0) freezes the sim")
    func reducedMotion() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(400, 300, 0), velocity: Vec3(10, 0, 0)))
        let env = makeEnv()
        env.dt = 0
        stepOnce(store: store, bodies: [], env: env)
        #expect(p.position.x == 400)
        #expect(p.velocity.x == 10)
    }

    @Test("velocity is capped at c")
    func velocityCap() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(400, 300, 0), velocity: Vec3(100, 0, 0)))
        let env = makeEnv()
        env.c = 12
        stepOnce(store: store, bodies: [], env: env)
        #expect(simd_length(p.velocity) <= 12 * FRICTION + 0.001)
    }

    @Test("toroidal wrap at the x edge")
    func toroidalWrap() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(815, 300, 0), velocity: Vec3(5, 0, 0)))
        let env = makeEnv() // W = 800, EDGE = 10
        stepOnce(store: store, bodies: [], env: env)
        #expect(p.position.x == -10) // wrapped to -EDGE
    }

    @Test("z does not wrap in a flat field (depth 0)")
    func noZWrapFlat() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(400, 300, 0), velocity: Vec3(0, 0, 5)))
        let env = makeEnv()
        stepOnce(store: store, bodies: [], env: env)
        #expect(abs(p.position.z - 5) < 0.001) // moved, not wrapped
    }

    @Test("captured matter drifts to the sink core and skips forces")
    func capturedDrift() {
        let store = FieldStore()
        let sink = makeBody(["sink"], at: Vec3(400, 300, 0))
        let p = store.add(Particle(position: Vec3(500, 300, 0), velocity: Vec3(9, 9, 0)))
        p.cap = sink
        let env = makeEnv()
        stepOnce(store: store, bodies: [sink], env: env)
        // drifted 18% toward the core, velocity untouched
        #expect(abs(p.position.x - (500 + (400 - 500) * 0.18)) < 0.001)
        #expect(p.velocity.x == 9)
    }

    @Test("mortal matter despawns when age expires")
    func mortalAge() {
        let store = FieldStore()
        let p = store.add(Particle(position: Vec3(400, 300, 0)))
        p.age = 1
        store.add(Particle(position: Vec3(100, 100, 0))) // immortal
        let env = makeEnv()
        stepOnce(store: store, bodies: [], env: env)
        #expect(store.size == 1)
        #expect(!store.particles.contains { $0 === p })
    }

    @Test("feedback body accumulates density count from nearby matter")
    func feedbackCount() {
        let store = FieldStore()
        let b = makeBody(["attract"], at: Vec3(400, 300, 0), range: 200)
        b.feedback = true
        store.add(Particle(position: Vec3(420, 300, 0))) // within range/2 = 100
        let env = makeEnv()
        stepOnce(store: store, bodies: [b], env: env)
        #expect(b.count > 0)
        #expect(b.thermo != nil)
    }

    @Test("invisible bodies exert no force")
    func invisibleBodies() {
        let store = FieldStore()
        let b = makeBody(["attract"], at: Vec3(400, 300, 0), strength: 5)
        b.isVisible = false
        let p = store.add(Particle(position: Vec3(450, 300, 0)))
        let env = makeEnv()
        stepOnce(store: store, bodies: [b], env: env)
        #expect(p.velocity.x == 0)
    }
}

// MARK: - Forces

@Suite("Forces")
struct ForceTests {

    private func applyTo(_ force: any Force, body: Body, particle: Particle,
                         volume: Vec3 = Vec3(800, 600, 0)) -> Env {
        let env = makeEnv(volume: volume)
        let delta = body.center - particle.position
        env.vector = delta
        env.dist = max(simd_length(delta), 1)
        force.apply(body: body, particle: particle, env: env)
        return env
    }

    @Test("attract pulls toward the body")
    func attractPulls() {
        let b = makeBody(["attract"], at: Vec3(400, 300, 0))
        let p = Particle(position: Vec3(500, 300, 0))
        _ = applyTo(AttractForce(), body: b, particle: p)
        #expect(p.velocity.x < 0) // toward the body (−x)
        #expect(abs(p.velocity.y) < 0.001)
    }

    @Test("repel pushes away from the body")
    func repelPushes() {
        let b = makeBody(["repel"], at: Vec3(400, 300, 0))
        let p = Particle(position: Vec3(500, 300, 0))
        _ = applyTo(RepelForce(), body: b, particle: p)
        #expect(p.velocity.x > 0) // away (+x)
    }

    @Test("attract beyond range is inert")
    func attractRange() {
        let b = makeBody(["attract"], at: Vec3(400, 300, 0), range: 50)
        let p = Particle(position: Vec3(500, 300, 0)) // dist 100 > 50
        _ = applyTo(AttractForce(), body: b, particle: p)
        #expect(p.velocity == .zero)
    }

    @Test("engaged attract heats nearby matter")
    func attractHeat() {
        let b = makeBody(["attract"], at: Vec3(400, 300, 0))
        b.isEngaged = true
        let p = Particle(position: Vec3(450, 300, 0))
        _ = applyTo(AttractForce(), body: b, particle: p)
        #expect(p.heat > 0)
    }

    @Test("magnetism preserves speed exactly (rotation, not work)")
    func magnetismPreservesSpeed() {
        let b = makeBody(["magnetism"], at: Vec3(400, 300, 0), strength: 0.5)
        let p = Particle(position: Vec3(450, 300, 0), velocity: Vec3(3, 4, 0))
        p.charge = 1
        let speedBefore = simd_length(p.velocity)
        _ = applyTo(MagnetismForce(), body: b, particle: p)
        let speedAfter = simd_length(p.velocity)
        #expect(abs(speedBefore - speedAfter) < 0.0001)
        #expect(p.velocity != Vec3(3, 4, 0)) // but the heading turned
    }

    @Test("magnetism ignores neutral matter")
    func magnetismNeutral() {
        let b = makeBody(["magnetism"], at: Vec3(400, 300, 0))
        let p = Particle(position: Vec3(450, 300, 0), velocity: Vec3(3, 4, 0))
        _ = applyTo(MagnetismForce(), body: b, particle: p)
        #expect(p.velocity == Vec3(3, 4, 0))
    }

    @Test("gravity is attractive and decays with distance")
    func gravityFalloff() {
        let b = makeBody(["gravity"], at: Vec3(400, 300, 0), range: 1000)
        b.M = 100
        let near = Particle(position: Vec3(450, 300, 0))
        let far  = Particle(position: Vec3(700, 300, 0))
        _ = applyTo(GravityForce(), body: b, particle: near)
        _ = applyTo(GravityForce(), body: b, particle: far)
        #expect(near.velocity.x < 0 && far.velocity.x < 0) // both pulled toward
        #expect(abs(near.velocity.x) > abs(far.velocity.x)) // 1/d² falloff
    }

    @Test("charge: like signs repel, opposite attract")
    func chargeSigns() {
        let b = makeBody(["charge"], at: Vec3(400, 300, 0), range: 1000)
        b.M = 100
        b.spin = 1
        let like = Particle(position: Vec3(500, 300, 0))
        like.charge = 1
        let opposite = Particle(position: Vec3(500, 300, 0))
        opposite.charge = -1
        _ = applyTo(ChargeForce(), body: b, particle: like)
        _ = applyTo(ChargeForce(), body: b, particle: opposite)
        #expect(like.velocity.x > 0)      // pushed away
        #expect(opposite.velocity.x < 0)  // pulled in
    }

    @Test("collide conserves momentum")
    func collideMomentum() {
        let b = makeBody(["collide"], at: Vec3(400, 300, 0), strength: 1, range: 1000)
        let p = Particle(position: Vec3(400, 300, 0), velocity: Vec3(2, 0, 0), size: 3)
        let q = Particle(position: Vec3(404, 300, 0), velocity: Vec3(-2, 0, 0), size: 3)
        let env = makeEnv()
        env.vector = b.center - p.position
        env.dist = 1
        env.neighbors = { _, _ in [q] }
        let before = p.velocity + q.velocity
        CollideForce().apply(body: b, particle: p, env: env)
        let after = p.velocity + q.velocity
        #expect(simd_length(before - after) < 0.0001)
        #expect(p.velocity.x < 2) // p recoiled
        #expect(q.velocity.x > -2) // q recoiled
    }

    @Test("sink captures within absorbR and supernovas at capacity")
    func sinkCapture() {
        let b = makeBody(["sink"], at: Vec3(400, 300, 0))
        b.absorbR = 50
        b.capacity = 2
        var supernovaed = false
        let env = makeEnv()
        env.supernova = { _ in supernovaed = true }

        let p1 = Particle(position: Vec3(420, 300, 0))
        env.vector = b.center - p1.position
        env.dist = 20
        SinkForce().apply(body: b, particle: p1, env: env)
        #expect(p1.cap === b)
        #expect(b.accreted == 1)
        #expect(!supernovaed)

        let p2 = Particle(position: Vec3(410, 300, 0))
        env.dist = 10
        SinkForce().apply(body: b, particle: p2, env: env)
        #expect(supernovaed) // hit capacity 2
    }

    @Test("releaseCaptured conserves matter and resets the load")
    func releaseConserves() {
        let b = makeBody(["sink"], at: Vec3(400, 300, 0))
        let p1 = Particle(position: Vec3(400, 300, 0))
        let p2 = Particle(position: Vec3(400, 300, 0))
        p1.cap = b
        p2.cap = b
        b.accreted = 2
        let released = releaseCaptured([p1, p2], from: b) { 0.5 }
        #expect(released.count == 2)
        #expect(b.accreted == 0)
        #expect(p1.cap == nil && p2.cap == nil)
        #expect(p1.heat == 1)
        #expect(simd_length(p1.velocity) > 3) // radial outward kick
        // ejected PAST the absorption radius so a sink can't re-grab its own ejecta next
        // frame (which would strobe the supernova and evacuate the catchment).
        #expect(abs(simd_distance(p1.position, b.center) - (b.absorbR + 6)) < 0.5)
    }

    @Test("wall reflects the axis of least penetration and stays planar on flat boxes")
    func wallBounce() {
        let b = Body(tokens: ["wall"],
                     box: Box(center: Vec3(400, 300, 0), halfExtents: Vec3(50, 30, 0)))
        b.isVisible = true
        // entering from the left edge, just inside
        let p = Particle(position: Vec3(352, 300, 0), velocity: Vec3(2, 0, 0))
        let env = makeEnv()
        env.vector = b.center - p.position
        env.dist = simd_length(env.vector)
        WallForce().apply(body: b, particle: p, env: env)
        #expect(p.velocity.x < 0)          // reflected
        #expect(p.position.x <= 344)       // ejected to the box face (hw + pad)
        #expect(p.velocity.z == 0)         // a flat box never reflects z
    }

    @Test("thermal kick is zero beyond range and nonzero inside")
    func thermalKick() {
        let b = makeBody(["thermal"], at: Vec3(400, 300, 0), strength: 2, range: 100)
        let inside = Particle(position: Vec3(420, 300, 0))
        _ = applyTo(ThermalForce(), body: b, particle: inside)
        #expect(simd_length(inside.velocity) > 0)

        let outside = Particle(position: Vec3(600, 300, 0))
        _ = applyTo(ThermalForce(), body: b, particle: outside)
        #expect(outside.velocity == .zero)
    }
}

// MARK: - Formations

@Suite("Formations")
struct FormationTests {

    @Test("easeFormation glides toward the target")
    func ease() {
        var current = Formation.neutral
        let target = Formation(driftX: 1, wander: 1, orbit: 1, spread: 1, conv: 1)
        easeFormation(&current, toward: target, rate: 0.5)
        #expect(abs(current.driftX - 0.5) < 0.001)
        easeFormation(&current, toward: target, rate: 0.5)
        #expect(abs(current.driftX - 0.75) < 0.001)
    }

    @Test("accretionTarget finds the first visible sink")
    func accretion() {
        let a = makeBody(["attract"])
        let s = makeBody(["sink"])
        let hidden = makeBody(["sink"])
        hidden.isVisible = false
        #expect(accretionTarget([a, hidden, s]) === s)
        #expect(accretionTarget([a]) == nil)
    }

    @Test("the five JS formation presets exist with matching values")
    func presets() {
        #expect(FORMATIONS.count == 5)
        let wells = formation(named: "wells")!
        #expect(wells.preset.orbit == 0.85)
        #expect(wells.preset.wander == 0.7)
        let lanes = formation(named: "lanes")!
        #expect(lanes.preset.driftX == 0.55)
    }
}

// MARK: - Reactions

@Suite("Reactions")
struct ReactionTests {

    @Test("burstImpulse falls off linearly and is inert outside r")
    func burst() {
        let near = burstImpulse(delta: Vec3(10, 0, 0), r: 100)
        let mid  = burstImpulse(delta: Vec3(50, 0, 0), r: 100)
        let out  = burstImpulse(delta: Vec3(150, 0, 0), r: 100)
        #expect(near.dv.x > mid.dv.x)
        #expect(mid.dv.x > 0)
        #expect(out.dv == .zero && out.heat == 0)
    }

    @Test("captureEdge fires on the rising and falling edge only")
    func edges() {
        #expect(captureEdge(prevArmed: false, accreting: true).fire == .captured)
        #expect(captureEdge(prevArmed: true, accreting: true).fire == nil)
        #expect(captureEdge(prevArmed: true, accreting: false).fire == .released)
        #expect(captureEdge(prevArmed: false, accreting: false).fire == nil)
    }

    @Test("thermalSigma follows fluctuation–dissipation (σ = √2T, floored at 0)")
    func sigma() {
        #expect(abs(thermalSigma(2) - 2) < 0.001) // √4 = 2
        #expect(thermalSigma(-5) == 0)
    }
}
