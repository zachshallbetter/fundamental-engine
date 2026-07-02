import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalCore

// Velocity-Verlet integrator mode (#659, the JS #958 mirror) — the opt-in second-order scheme,
// pinned test-for-test against packages/core/src/core/integrator-verlet.test.ts (and the Kotlin
// port's IntegratorVerletTests — the three planes hold the same seven pins).
//
// Pins: (1) the default (.legacy) trajectory is untouched by the new code paths; (2) pure drift
// (a = 0) reduces exactly to the legacy step; (3) the half-step average follows the
// stored-acceleration equations (`x += v·dt + ½·a·dt²`, then `v += ½·(a + a′)·dt`) to the digit;
// (4) a kinematic (velocity-REPLACING) force is treated as a discontinuity — never averaged — and
// resets the stored acceleration; (5) the particle-count invariant holds over a long forced run
// (the one strong invariant of the caveat canon). Plus the seam pin the JS keeps in its own suite:
// .fixed at dt = 1 is the legacy step, and dt-scales the decay away from it.

private func makeEnv(_ mode: IntegratorMode = .legacy, frame: Int = 1) -> Env {
    let env = Env()
    env.volume = Vec3(1000, 800, 0)
    env.dt = 1
    env.frameN = frame
    env.integrator = mode
    return env
}

// the attract body used throughout: at (100,100) vs center x 250 (range 300) the frame-0 Δvx is
// exactly 0.125 — the same geometry the JS suite pins.
private func attractBody() -> Body {
    let b = Body(tokens: ["attract"], strength: 1, range: 300,
                 box: Box(center: Vec3(250, 100, 0), halfExtents: Vec3(50, 20, 0)))
    b.isVisible = true
    return b
}

private func runStep(_ store: FieldStore, _ bodies: [Body], _ forces: ForceRegistry, _ env: Env) {
    store.reindex()
    step(StepInput(store: store, bodies: bodies, env: env, forces: forces))
}

private let attract: ForceRegistry = ["attract": AttractForce()]

/// A kinematic force that REPLACES velocity (a bounce/relaunch) — the discontinuity probe.
private struct RelaunchForce: Force {
    let token = "relaunch"
    let label = "Relaunch"
    let isKinematic = true
    func apply(body: Body, particle p: Particle, env: Env) {
        p.velocity.x = -5
    }
}

@Suite("velocity-Verlet integrator mode (#659)")
struct IntegratorVerletTests {

    @Test("pure drift (no forces, a = 0) reduces exactly to the legacy step")
    func pureDriftReducesToLegacy() {
        let legacyStore = FieldStore()
        let legacy = Particle(position: Vec3(100, 100, 0), velocity: Vec3(2, 0, 0))
        legacyStore.add(legacy)
        runStep(legacyStore, [], [:], makeEnv())

        let verletStore = FieldStore()
        let verlet = Particle(position: Vec3(100, 100, 0), velocity: Vec3(2, 0, 0))
        verletStore.add(verlet)
        runStep(verletStore, [], [:], makeEnv(.velocityVerlet))

        // Δv = 0 and a(t) = 0 ⇒ x += v·dt and v(t+dt) = v(t), then the same (dt = 1) decay.
        #expect(verlet.position.x == legacy.position.x, "x identical with no acceleration")
        #expect(verlet.velocity.x == legacy.velocity.x, "vx identical with no acceleration")
        #expect(legacy.position.x == 102, "sanity: drift moved v·dt")
        #expect(legacy.velocity.x == 2 * FRICTION, "sanity: one decay applied")
    }

    @Test("default-mode trajectory is unchanged (the classic semi-implicit step, to the digit)")
    func defaultModeUnchanged() {
        // The golden regen is the cross-plane proof; this pins the same fact in-tree. Legacy order is
        // forces → x += v·dt → decay, so from rest under attract: vx = Δv, x += Δv·dt, vx *= FRICTION.
        let store = FieldStore()
        let p = Particle(position: Vec3(100, 100, 0))
        store.add(p)
        runStep(store, [attractBody()], attract, makeEnv())
        #expect(p.position.x == 100.125, "legacy position: x += Δv·dt with Δv = 0.125")
        #expect(p.velocity.x == 0.125 * FRICTION, "legacy velocity: Δv then one decay")
    }

    @Test("the half-step average follows the stored-acceleration equations exactly")
    func halfStepAverageEquations() {
        // From rest with no stored acceleration: the position full-step is a no-op (v = a = 0), the
        // force pass lands Δv = 0.125 at the unmoved position, and the half-step average takes half:
        // v = v0 + ½(a·dt + Δv) = 0.0625, then the dt-scaled decay (dt = 1 ⇒ ·FRICTION). The pass's
        // Δv/dt is stored as a(t) for the next step.
        let store = FieldStore()
        let p = Particle(position: Vec3(100, 100, 0))
        store.add(p)
        runStep(store, [attractBody()], attract, makeEnv(.velocityVerlet))
        #expect(p.position.x == 100, "step 1 position full-step is a no-op from rest")
        #expect(p.velocity.x == 0.0625 * FRICTION, "v(t+dt) = ½·Δv, then one decay")
        #expect(p.accel?.x == 0.125, "the pass Δv/dt is stored as a(t) for the next step")

        // Step 2: the position full-step now carries both lanes — x += v·dt + ½·a·dt².
        let v1 = p.velocity.x
        runStep(store, [attractBody()], attract, makeEnv(.velocityVerlet, frame: 2))
        let expectedX = 100 + v1 * 1 + 0.5 * 0.125 * 1 * 1
        #expect(abs(p.position.x - expectedX) < 1e-4, "step 2 x = x + v·dt + ½·a·dt² (\(p.position.x) vs \(expectedX))")
    }

    @Test("matter accelerates toward an attracting body; the trajectory is second-order (differs from legacy)")
    func secondOrderDiffersFromLegacy() {
        let legacyStore = FieldStore()
        let legacy = Particle(position: Vec3(100, 100, 0))
        legacyStore.add(legacy)
        let verletStore = FieldStore()
        let verlet = Particle(position: Vec3(100, 100, 0))
        verletStore.add(verlet)
        for i in 1...5 {
            runStep(legacyStore, [attractBody()], attract, makeEnv(frame: i))
            runStep(verletStore, [attractBody()], attract, makeEnv(.velocityVerlet, frame: i))
        }
        #expect(legacy.position.x > 100 && verlet.position.x > 100, "both schemes move toward the body")
        #expect(verlet.position.x.isFinite && verlet.velocity.x.isFinite, "verlet stays finite")
        #expect(verlet.position.x != legacy.position.x, "the second-order trajectory differs from semi-implicit Euler")
    }

    @Test("a kinematic (velocity-replacing) force is a discontinuity — never averaged")
    func kinematicDiscontinuity() {
        // Averaging a replaced velocity with v(t) would gut the reflection (a head-on bounce would
        // stall near 0) — the mode must let it stand and reset the stored acceleration so the next
        // position step doesn't extrapolate across the break.
        let store = FieldStore()
        let p = Particle(position: Vec3(100, 100, 0), velocity: Vec3(2, 0, 0))
        p.accel = Vec3(0.4, 0, 0) // a stored acceleration that must be dropped
        store.add(p)
        let body = Body(tokens: ["relaunch"], strength: 1, range: 300,
                        box: Box(center: Vec3(100, 100, 0), halfExtents: Vec3(50, 20, 0)))
        body.isVisible = true
        runStep(store, [body], ["relaunch": RelaunchForce()], makeEnv(.velocityVerlet))
        #expect(p.velocity.x == -5 * FRICTION, "the replaced velocity stands (only the decay applies)")
        #expect(p.accel == Vec3.zero, "the stored acceleration resets at the discontinuity")
    }

    @Test("the particle-count invariant holds over a long forced run")
    func countInvariant() {
        let store = FieldStore()
        for i in 0..<24 {
            store.add(Particle(position: Vec3(40 * Float(i + 1), 60 + 25 * Float(i), 0),
                               velocity: Vec3(Float(i % 5 - 2), Float(i % 3 - 1), 0)))
        }
        let before = store.size
        for i in 1...50 {
            let env = makeEnv(.velocityVerlet, frame: i)
            env.t = Float(i) / 60
            runStep(store, [attractBody()], attract, env)
        }
        #expect(store.size == before, "no matter created or destroyed")
        for p in store.particles {
            #expect(p.position.x.isFinite && p.position.y.isFinite, "positions stay finite")
            #expect(p.velocity.x.isFinite && p.velocity.y.isFinite, "velocities stay finite")
        }
    }

    @Test(".fixed is the legacy step at dt = 1, and dt-scales the decay away from it")
    func fixedModeSeam() {
        // The .fixed seam ships with the same enum (doc 04 §Step 3): at dt = 1 it is the legacy
        // step to the digit (`pow(x, 1) == x`) …
        let legacyStore = FieldStore()
        let legacy = Particle(position: Vec3(100, 100, 0))
        legacyStore.add(legacy)
        let fixedStore = FieldStore()
        let fixed = Particle(position: Vec3(100, 100, 0))
        fixedStore.add(fixed)
        for i in 1...5 {
            runStep(legacyStore, [attractBody()], attract, makeEnv(frame: i))
            runStep(fixedStore, [attractBody()], attract, makeEnv(.fixed, frame: i))
        }
        #expect(fixed.position.x == legacy.position.x, ".fixed at dt = 1 is the legacy trajectory")
        #expect(fixed.velocity.x == legacy.velocity.x, ".fixed at dt = 1 is the legacy velocity")

        // … and away from dt = 1 the per-step decay scales (`FRICTION^dt`), frame-rate independent.
        let halfStore = FieldStore()
        let half = Particle(position: Vec3(100, 100, 0), velocity: Vec3(2, 0, 0))
        halfStore.add(half)
        let env = makeEnv(.fixed)
        env.dt = 0.5
        runStep(halfStore, [], [:], env)
        #expect(half.position.x == 101, "position integrates v·dt")
        #expect(abs(half.velocity.x - 2 * pow(FRICTION, 0.5)) < 1e-6, ".fixed dt-scales the decay")
    }
}
