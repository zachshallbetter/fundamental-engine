package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Formation
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.math.Vec3
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Cross-plane conformance (#526) — the Kotlin engine must reproduce the JS engine's force math.
//
// `fixtures/conformance-golden.json` (synced onto the classpath from the canonical Swift fixture by
// the `syncGolden` Gradle task — single source of truth) is emitted by
// `scripts/gen-conformance-golden.mjs`: the canonical deterministic forces fired at a fan of probe
// particles, each with its frame-0 velocity delta (`dv`) as computed by the f64 JS engine. Here the
// f32 Kotlin engine applies the same force to the same reconstructed inputs and must land on `dv`.
//
// Tolerance is a single force apply (no integration accumulation), so f32↔f64 drift is tiny: an
// absolute 2e-4 with a small relative term covers it while still catching a real formula divergence
// (a wrong coefficient, a missing falloff leg, a sign flip). When this fails, the JS and Kotlin
// ports of that force have diverged — fix the Kotlin force, never loosen the tolerance to hide it.

@Serializable
private data class GoldenFile(val count: Int, val cases: List<GoldenCase>)

@Serializable
private data class GoldenCase(
    val force: String,
    val label: String,
    val px: Float,
    val py: Float,
    val body: BodyJson,
    val env: EnvJson,
    val particle: Vel,
    val dv: DV,
)

@Serializable
private data class BodyJson(
    val strength: Float,
    val range: Float,
    val spin: Float,
    val on: Boolean,
    val ux: Float,
    val uy: Float,
)

@Serializable
private data class EnvJson(val dx: Float, val dy: Float, val dz: Float, val dist: Float, val orbit: Float)

@Serializable
private data class Vel(val vx: Float, val vy: Float, val vz: Float)

@Serializable
private data class DV(val x: Float, val y: Float, val z: Float)

class GoldenConformanceTests {

    private val json = Json { ignoreUnknownKeys = true }

    private fun loadGolden(): GoldenFile {
        val stream = javaClass.getResourceAsStream("/fixtures/conformance-golden.json")
            ?: error("conformance-golden.json missing on the classpath — run `pnpm gen:golden` (Gradle's syncGolden task pulls it in)")
        val text = stream.bufferedReader().use { it.readText() }
        return json.decodeFromString(GoldenFile.serializer(), text)
    }

    @Test
    fun parity() {
        val golden = loadGolden()
        assertTrue(golden.cases.size == golden.count && golden.count > 0, "golden file is empty or mis-counted")

        val registry = Registry.standardForces()
        var checked = 0

        for (c in golden.cases) {
            val force = registry[c.force] ?: error("Kotlin registry has no force '${c.force}'")

            // reconstruct the exact inputs the JS apply saw (matches GoldenConformanceTests.swift).
            val body = Body(
                tokens = listOf(c.force),
                strength = c.body.strength,
                range = c.body.range,
                spin = c.body.spin,
                heading = Vec3(c.body.ux, c.body.uy, 0f),
            )
            body.isEngaged = c.body.on

            val p = Particle(
                position = Vec3(c.px, c.py, 0f),
                velocity = Vec3(c.particle.vx, c.particle.vy, c.particle.vz),
            )

            val env = Env().apply {
                vector = Vec3(c.env.dx, c.env.dy, c.env.dz) // JS e.dx/dy/dz == Kotlin env.vector
                dist = c.env.dist
                form = Formation(orbit = c.env.orbit)
            }

            val v0 = p.velocity
            force.apply(body, p, env)
            val dv = p.velocity - v0
            val want = Vec3(c.dv.x, c.dv.y, c.dv.z)

            val tol = 2e-4f + 1e-3f * want.length()
            val err = (dv - want).length()
            assertTrue(
                err <= tol,
                "${c.force}/${c.label} @(${c.px},${c.py}): Kotlin dv=(${dv.x},${dv.y},${dv.z}) " +
                    "vs JS (${want.x},${want.y},${want.z}) — err $err > tol $tol",
            )
            checked++
        }
        assertEquals(golden.count, checked)
    }
}
