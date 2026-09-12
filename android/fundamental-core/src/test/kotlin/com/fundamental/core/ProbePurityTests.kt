package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.ForceRegistry
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.forceAt
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Render-probe purity (#1172 — the Kotlin half of #1155 / #1162).
//
// Drawing a diagnostic must never move the simulation. `forceAt` measures the field with a
// FICTITIOUS test particle; it used to run every body's real `apply()` against a bare `Env()` with
// no marker on it, so `sink.apply` advanced a REAL body's accretion budget (`body.accreted += 1f`)
// on every probe point of every frame.
//
// Kotlin's exposure is unbounded, exactly like Swift's and unlike the JS engine's. JS shares one
// module-level probe particle whose `cap` was never cleared, so `sink`'s own `if (p.cap || …)
// return` guard short-circuited for the life of the process and a body was over-accreted exactly
// ONCE — self-limiting by accident. Kotlin builds a FRESH `Particle` per call (`Streamlines.kt`), so
// `cap` is always null and that guard never fires.
//
// What Kotlin gets right by ACCIDENT is only the env half: `forceAt` builds its own `Env()` rather
// than threading the caller's, and Kotlin's `Env` service defaults are already no-ops, so the
// `supernova` at capacity does nothing and no body detonates on the spot. The corrupted `accreted`
// is still real — it drives the body's load metric and feedback vars, and it pushes the body past
// `capacity`, so the INTEGRATOR'S next genuine capture detonates it early. A causeless detonation,
// some time after the drawing that caused it.
//
// The fix mirrors #1166 (JS) and #1171 (Swift): the probe runs under a deliberate, inert env
// (`makeProbeEnv()` — no-op services, its own per-sample reseeded rng) carrying an `Env.isProbe`
// marker that `sink` checks before accreting. An inert env ALONE cannot close this: `sink` writes
// `body.accreted` directly, through no service an inert env could stub. One writer, one reader.

class ProbePurityTests {

    private val forces: ForceRegistry = Registry.standardForces()

    private companion object {
        const val W = 800f
        const val H = 600f
        const val GRID = 46f // the streamlines / flow grid pitch
    }

    private fun body(
        tokens: List<String>,
        cx: Float,
        cy: Float,
        strength: Float = 1.5f,
        range: Float = 240f,
        absorbR: Float = 120f,
        capacity: Float = 60f,
    ) = Body(
        tokens = tokens,
        strength = strength,
        range = range,
        absorbR = absorbR,
        capacity = capacity,
        spin = 1f,
        heading = Vec3(1f, 0f, 0f),
        box = Box(center = Vec3(cx, cy, 0f), halfExtents = Vec3(30f, 14f, 0f)),
    ).apply { isVisible = true } // forceAt culls invisible bodies

    /** One frame of the streamlines underlay: the grid walk `Overlays`/the renderers perform verbatim. */
    private fun drawOneFrame(bodies: List<Body>): Int {
        var samples = 0
        var gx = GRID / 2
        while (gx < W) {
            var gy = GRID / 2
            while (gy < H) {
                forceAt(bodies, forces, Vec3(gx, gy, 0f))
                samples++
                gy += GRID
            }
            gx += GRID
        }
        return samples
    }

    // ── 1. the accretion budget is UNCHANGED, not merely "incremented once" ───────────────────────

    @Test
    fun drawingStreamlinesOverASinkLeavesItsAccretionUntouched() {
        val sink = body(listOf("sink"), W / 2, H / 2, absorbR = 150f, capacity = 4f)

        // non-vacuity: the walk really does put probe points deep inside the absorb radius, so a pass
        // here cannot mean "the probe never met the sink".
        var inside = 0
        var gx = GRID / 2
        while (gx < W) {
            var gy = GRID / 2
            while (gy < H) {
                if ((Vec3(gx, gy, 0f) - sink.center).length() < sink.absorbR) inside++
                gy += GRID
            }
            gx += GRID
        }
        assertTrue(inside > 0, "the grid walk samples inside absorbR — the assertions below are real")

        for (frame in 0 until 12) {
            drawOneFrame(listOf(sink))
            // asserted EVERY frame, so the two failure modes fail differently: a leak that is
            // self-limiting by accident (JS: 1, then flat) and one that accretes per sample
            // (Kotlin/Swift: linear in frames).
            assertEquals(
                0f, sink.accreted,
                "frame $frame: drawing must not accrete (accreted = ${sink.accreted})",
            )
        }
    }

    // ── 2. a sample is a function of its point, not of the sampling history ───────────────────────

    @Test
    fun twoSamplesAtTheSamePointAgreeWhateverWasSampledBetween() {
        // `jet` at its nozzle relaunches the probe along a randomly jittered heading drawn from
        // `env.rng`. The bare `Env()` the probe used to run under defaults `rng` to the PLATFORM
        // generator, so the same point read a different vector every time it was drawn — a diagnostic
        // that cannot be reproduced. (A `sink` sits in the field too, so the in-between sweep also
        // walks the accretion path; that its budget stays put is test 1.)
        val nozzle = body(listOf("jet"), 200f, 150f, range = 300f)
        val sink = body(listOf("sink"), 600f, 450f, absorbR = 150f, capacity = 1_000_000f)
        val bodies = listOf(nozzle, sink)

        val at = Vec3(210f, 150f, 0f) // inside the nozzle (dist < 24)
        val first = forceAt(bodies, forces, at)
        assertTrue(first.length() > 0f, "the probe point reads a live jet relaunch")

        // …sample the rest of the field in between — a full frame's grid walk, plus more nozzle points.
        drawOneFrame(bodies)
        forceAt(bodies, forces, Vec3(196f, 152f, 0f))
        forceAt(bodies, forces, Vec3(204f, 144f, 0f))

        val second = forceAt(bodies, forces, at)
        assertEquals(
            first, second,
            "the same point must read the same vector after any other sampling ($first vs $second)",
        )
    }

    // ── 3. drawing draws only from the probe's OWN stream ─────────────────────────────────────────

    @Test
    fun drawingDoesNotDrawFromTheSimulationRngStream() {
        val jet = body(listOf("jet"), W / 2, H / 2, range = 900f) // jet jitters through env.rng

        // (a) the probe has its own stream, reseeded per sample: two identical frames draw identically.
        //     Before the fix the probe ran on a bare `Env()`, whose `rng` default is the platform
        //     generator — so a drawn frame was irreproducible and this fails.
        //     The walk is the render grid PLUS 24 points inside the nozzle (`dist < 24`, the only leg
        //     of `jet` that draws from `rng`), so the stochastic sample count is 24, not the single
        //     grid point that happens to land there.
        val points = mutableListOf<Vec3>()
        var gx = GRID / 2
        while (gx < W) {
            var gy = GRID / 2
            while (gy < H) { points.add(Vec3(gx, gy, 0f)); gy += GRID }
            gx += GRID
        }
        val nozzle = jet.center
        for (k in 0 until 24) points.add(nozzle + Vec3(4f + (k % 4), 4f + (k / 4), 0f))

        val firstPass = points.map { forceAt(listOf(jet), forces, it) }
        val secondPass = points.map { forceAt(listOf(jet), forces, it) }
        val moved = firstPass.indices.count { firstPass[it] != secondPass[it] }
        assertTrue(firstPass.any { it.length() > 0f }, "the walk really reads the jet — not a vacuous pass")
        assertEquals(0, moved, "a drawn frame must be reproducible ($moved of ${firstPass.size} samples moved)")

        // (b) and it never touches the SIMULATION's seeded stream: a seeded run is bit-identical
        //     whether or not the host drew the overlay between steps (#974 record/replay). Kotlin's
        //     `forceAt` already built its own env, so this half holds on both sides of the fix — it is
        //     the regression guard that keeps it that way.
        fun run(draw: Boolean): List<Vec3> {
            val fc = FieldController(width = W, height = H, particleCount = 60, seed = 11)
            fc.addBody(Body(tokens = listOf("jet"), strength = 1.5f, range = 900f, box = Box(center = Vec3(W / 2, H / 2, 0f))))
            repeat(10) {
                fc.tick()
                if (draw) {
                    var x = GRID / 2
                    while (x < W) { var y = GRID / 2; while (y < H) { fc.sample(x, y); y += GRID }; x += GRID }
                }
            }
            return fc.particles.map { it.position }
        }
        assertEquals(run(draw = false), run(draw = true), "drawing must not advance the simulation's seeded stream")
    }

    // ── 4. the public read-out (FieldHandle.sample → FieldController.sample) ──────────────────────

    @Test
    fun thePublicSamplerNeverFillsOrDetonatesARealSink() {
        // The live rig, with the engine's REAL services wired: `env.supernova` here ejects captured
        // matter and fires `onSupernova`. This is the path a host actually drives (`FieldHandle.sample`
        // → `FieldController.sample` → `forceAt`), so it proves the fix where it ships, and it is where
        // the delayed damage would surface: an `accreted` pushed past `capacity` by drawing detonates
        // on the integrator's next genuine capture.
        val fc = FieldController(width = W, height = H, particleCount = 0, seed = 5)
        var supernovas = 0
        fc.onSupernova = { _, _ -> supernovas++ }
        val sink = fc.addBody(
            Body(
                tokens = listOf("sink", "attract"), strength = 1.6f, range = 900f,
                absorbR = 260f, capacity = 4f, box = Box(center = Vec3(W / 2, H / 2, 0f)),
            ),
        )
        assertEquals(0f, sink.accreted, "the sink starts empty")

        var read = 0
        for (pass in 0 until 5) {
            var x = GRID / 2
            while (x < W) {
                var y = GRID / 2
                while (y < H) {
                    if (fc.sample(x, y).length() > 0f) read++
                    y += GRID
                }
                x += GRID
            }
            assertEquals(0f, sink.accreted, "pass $pass: reading the field filled a real sink (accreted = ${sink.accreted})")
        }
        assertTrue(read > 0, "the probe really did read this body — the assertions above are not vacuous")
        assertEquals(0, supernovas, "drawing must never detonate a real body")
    }

    // ── 5. the DELAYED detonation — Kotlin's actual symptom ───────────────────────────────────────

    @Test
    fun drawingTheOverlayDoesNotDetonateABodyOnALaterFrame() {
        // Kotlin never detonated on the spot the way Swift did: `forceAt`'s bare `Env()` leaves
        // `supernova` at its no-op default. That is what made this bug HARDER to diagnose rather than
        // milder — the drawn accretion still lands on the real body and pushes it past `capacity`, so
        // the INTEGRATOR'S next genuine capture fires the live `supernova`. A body detonates with no
        // cause the simulation can account for, some frames after the drawing that caused it.
        //
        // Asserted as an EQUALITY between two identically seeded runs — one that drew the overlay each
        // frame and one that did not — rather than against an absolute count, so it stays honest if the
        // integrator's numbers ever move.
        fun run(draw: Boolean): Triple<Int, Float, List<Vec3>> {
            val fc = FieldController(width = W, height = H, particleCount = 120, seed = 5)
            var supernovas = 0
            fc.onSupernova = { _, _ -> supernovas++ }
            val sink = fc.addBody(
                Body(
                    tokens = listOf("sink", "attract"), strength = 1.6f, range = 900f,
                    absorbR = 120f, capacity = 400f, box = Box(center = Vec3(W / 2, H / 2, 0f)),
                ),
            )
            repeat(30) {
                if (draw) {
                    var x = GRID / 2
                    while (x < W) { var y = GRID / 2; while (y < H) { fc.sample(x, y); y += GRID }; x += GRID }
                }
                fc.tick()
            }
            return Triple(supernovas, sink.accreted, fc.particles.map { it.position })
        }

        val (snOff, accOff, posOff) = run(draw = false)
        val (snOn, accOn, posOn) = run(draw = true)
        assertTrue(accOff > 0f, "the integrator really does capture matter here — not a vacuous run")
        assertEquals(accOff, accOn, "drawing changed the sink's real accretion ($accOff → $accOn)")
        assertEquals(snOff, snOn, "drawing detonated a body on a later frame ($snOff → $snOn supernovas)")
        assertEquals(posOff, posOn, "drawing moved the simulation")
    }
}
