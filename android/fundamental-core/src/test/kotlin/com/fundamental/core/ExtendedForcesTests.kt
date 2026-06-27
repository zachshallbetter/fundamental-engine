package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Particle
import com.fundamental.core.forces.AlignForce
import com.fundamental.core.forces.BuoyancyForce
import com.fundamental.core.forces.CohesionForce
import com.fundamental.core.forces.CrystallizeForce
import com.fundamental.core.forces.FieldFlowForce
import com.fundamental.core.forces.GateForce
import com.fundamental.core.forces.HuntForce
import com.fundamental.core.forces.LensForce
import com.fundamental.core.forces.LinkForce
import com.fundamental.core.forces.MorphForce
import com.fundamental.core.forces.PigmentForce
import com.fundamental.core.forces.PressureForce
import com.fundamental.core.forces.ResonateForce
import com.fundamental.core.forces.ScreenForce
import com.fundamental.core.forces.ShearForce
import com.fundamental.core.forces.SpawnForce
import com.fundamental.core.forces.SpotlightForce
import com.fundamental.core.forces.WarpForce
import com.fundamental.core.forces.WindForce
import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Designed extended forces (§20.3). Closed-form ones (lens, gate, buoyancy, shear, crystallize, wind,
// cohesion, pressure, link, hunt, warp, the modifiers) are checked exactly; neighbor/RNG/field ones
// against a constructed Env.

class ExtendedForcesTests {

    @Test
    fun lensRotatesVelocityPreservingSpeed() {
        val body = Body(tokens = listOf("lens"), range = 300f, strength = 0.1f, spin = 1f)
        val p = Particle(velocity = Vec3(1f, 0f, 0f))
        LensForce().apply(body, p, Env().apply { dist = 150f })
        val theta = 0.1f * (1f - 0.5f) * 1f // 0.05
        assertClose(kotlin.math.cos(theta), p.velocity.x)
        assertClose(kotlin.math.sin(theta), p.velocity.y)
        assertClose(1f, p.velocity.length(), msg = "a lens bends the path, not the speed")
    }

    @Test
    fun gateReflectsWrongWayCrossersOnly() {
        val body = Body(tokens = listOf("gate"), heading = Vec3(0f, -1f, 0f), box = Box(halfExtents = Vec3(50f, 50f, 0f)))
        // wrong-way (moving +y, against the −y heading) → reflected.
        val wrong = Particle(position = Vec3.ZERO, velocity = Vec3(0f, 1f, 0f))
        GateForce().apply(body, wrong, Env())
        assertClose(-1f, wrong.velocity.y, msg = "wrong-way crosser reflected")
        // right-way (moving −y, with the heading) → passes untouched.
        val right = Particle(position = Vec3.ZERO, velocity = Vec3(0f, -1f, 0f))
        GateForce().apply(body, right, Env())
        assertEquals(Vec3(0f, -1f, 0f), right.velocity)
    }

    @Test
    fun buoyancyLiftsLighterMatter() {
        val body = Body(tokens = listOf("buoyancy"), range = 0f, strength = 1f) // global
        val light = Particle(heat = 1f, size = 1f) // ρ = 1/(1·2) = 0.5 → lighter than the medium
        BuoyancyForce().apply(body, light, Env())
        assertClose(-0.5f, light.velocity.y, msg = "lighter matter rises (−y)")
    }

    @Test
    fun shearAcceleratesAlongFlowByPerpendicularOffset() {
        val body = Body(tokens = listOf("shear"), range = 100f, strength = 1f, heading = Vec3(1f, 0f, 0f))
        val p = Particle(position = Vec3(0f, 10f, 0f)) // perp offset = 10 along +y
        ShearForce().apply(body, p, Env().apply { dist = 50f })
        assertClose(0.05f, p.velocity.x, msg = "strength·(offset/range)·(1−d/range)")
    }

    @Test
    fun crystallizeSnapsCoolMatterTowardLatticeNode() {
        val body = Body(tokens = listOf("crystallize"), range = 300f, strength = 0.1f)
        val cool = Particle(position = Vec3(10f, 0f, 0f), heat = 0f) // nearest node is the origin
        CrystallizeForce().apply(body, cool, Env().apply { dist = 50f })
        assertClose(-0.9f, cool.velocity.x, msg = "pull to node (−1), then damp ×0.9")
        // hot matter has melted → free.
        val hot = Particle(position = Vec3(10f, 0f, 0f), heat = 0.9f)
        CrystallizeForce().apply(body, hot, Env().apply { dist = 50f })
        assertEquals(Vec3.ZERO, hot.velocity)
    }

    @Test
    fun alignSteersTowardMeanNeighbourHeading() {
        val body = Body(tokens = listOf("align"), range = 100f, strength = 0.5f)
        val p = Particle(velocity = Vec3(1f, 0f, 0f))
        val neighbour = Particle(velocity = Vec3(0f, 2f, 0f)) // unit heading (0,1,0)
        AlignForce().apply(body, p, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(neighbour) } })
        assertClose(0.5f, p.velocity.x)
        assertClose(0.5f, p.velocity.y)
    }

    @Test
    fun windIsADeterministicDivergenceFreeCurl() {
        val body = Body(tokens = listOf("wind"), range = 0f, strength = 1f)
        val p = Particle(position = Vec3.ZERO)
        WindForce().apply(body, p, Env().apply { t = 0f })
        // curl(0,0,0,0.01) = (0, −0.01, 0)
        assertClose(0f, p.velocity.x)
        assertClose(-0.01f, p.velocity.y)
    }

    @Test
    fun cohesionPushesApartInsideRestDistance() {
        val body = Body(tokens = listOf("cohesion"), range = 100f, strength = 1f) // r0 = 50
        val p = Particle(position = Vec3.ZERO)
        val near = Particle(position = Vec3(30f, 0f, 0f)) // inside r0 → pressure
        CohesionForce().apply(body, p, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(near) } })
        assertClose(-0.4f, p.velocity.x, msg = "push apart: k·(r0−d)/r0")
    }

    @Test
    fun pressurePushesAwayFromCrowding() {
        val body = Body(tokens = listOf("pressure"), range = 100f, strength = 1f)
        val p = Particle(position = Vec3.ZERO)
        val crowd = Particle(position = Vec3(1f, 0f, 0f)) // very close → over rest density
        PressureForce().apply(body, p, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(crowd) } })
        assertTrue(p.velocity.x < 0f, "pushed away from the crowd")
        val over = (1f - 1f / 100f) * (1f - 1f / 100f) - 0.5f
        assertClose(-(over * (1f - 1f / 100f)), p.velocity.x, tol = 1e-3f)
    }

    @Test
    fun linkPullsTowardRestLengthWhenStretched() {
        val body = Body(tokens = listOf("link"), range = 100f, strength = 1f) // L = 35
        val p = Particle(position = Vec3.ZERO)
        val far = Particle(position = Vec3(50f, 0f, 0f)) // stretched beyond L
        LinkForce().apply(body, p, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(far) } })
        assertClose(0.5f * (15f / 35f), p.velocity.x, msg = "half-correction toward rest length")
    }

    @Test
    fun huntPredatorChasesPreyFlees() {
        val body = Body(tokens = listOf("hunt"), range = 100f, strength = 1f)
        val prey = Particle(position = Vec3(10f, 0f, 0f)).apply { species = 1 }
        val predator = Particle(position = Vec3.ZERO).apply { species = 0 }
        HuntForce().apply(body, predator, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(prey) } })
        assertClose(1f, predator.velocity.x, msg = "predator accelerates toward prey")

        val fleeing = Particle(position = Vec3.ZERO).apply { species = 1 }
        val hunter = Particle(position = Vec3(10f, 0f, 0f)).apply { species = 0 }
        HuntForce().apply(body, fleeing, Env().apply { dist = 10f; neighbors = { _, _ -> listOf(hunter) } })
        assertClose(-1f, fleeing.velocity.x, msg = "prey accelerates away")
    }

    @Test
    fun morphSpringsTowardTargetAndIsInertWithoutOne() {
        val body = Body(tokens = listOf("morph"), strength = 1f).apply { targets = listOf(Vec3(100f, 0f, 0f)) }
        val p = Particle(position = Vec3.ZERO).apply { gx = 0f }
        MorphForce().apply(body, p, Env())
        // spring = d3·k·0.02 = (2,0,0); a fading jitter (≤0.15) rides on top.
        assertTrue(kotlin.math.abs(p.velocity.x - 2f) <= 0.15f, "springs toward target (~2 ± jitter)")

        val inert = Particle()
        MorphForce().apply(Body(tokens = listOf("morph")), inert, Env())
        assertEquals(Vec3.ZERO, inert.velocity, "no targets → inert")
    }

    @Test
    fun spawnEmitsBudgetedMortalMatter() {
        val spawned = mutableListOf<Particle>()
        val env = Env().apply { spawn = { spawned.add(it) } }
        val body = Body(tokens = listOf("spawn"), strength = 1f) // rate = round(2) = 2 / frame
        SpawnForce().source(body, env)
        assertEquals(2, spawned.size, "two particles this frame")
        assertTrue(spawned.all { it.age == 90f && it.heat == 0.6f }, "mortal, hot")
        assertTrue(spawned.all { it.velocity.length() in 2f..4f }, "speed in [2,4]")
    }

    @Test
    fun spawnRespectsTheSourceCapBudget() {
        val spawned = mutableListOf<Particle>()
        val env = Env().apply { spawn = { spawned.add(it) } }
        val body = Body(tokens = listOf("spawn"), strength = 1f).apply { sourceCap = 45; life = 90f } // rate = 0.5/frame
        SpawnForce().source(body, env) // emitAcc 0.5 → 0 emitted
        assertEquals(0, spawned.size)
        SpawnForce().source(body, env) // emitAcc 1.0 → 1 emitted
        assertEquals(1, spawned.size, "the fractional accumulator gates the rate to cap/life")
    }

    @Test
    fun resonateModulatesSiblingStrength() {
        val r = ResonateForce()
        assertTrue(r.hasModify)
        assertClose(1f, r.modify(Body(tokens = listOf("resonate"), spin = 1f), Particle(), Env().apply { t = 0f }).strength!!)
        val peak = r.modify(Body(tokens = listOf("resonate"), spin = 1f), Particle(), Env().apply { t = (PI / 6).toFloat() })
        assertClose(2f, peak.strength!!, msg = "1 + sin(ωt) peaks at 2")
    }

    @Test
    fun spotlightGatesSiblingsOutsideTheCone() {
        val s = SpotlightForce()
        assertTrue(s.hasModify)
        val body = Body(tokens = listOf("spotlight"), heading = Vec3(1f, 0f, 0f))
        // particle in front of the heading (body→particle aligns with heading) → not gated.
        val inFront = s.modify(body, Particle(), Env().apply { vector = Vec3(-100f, 0f, 0f); dist = 100f })
        assertTrue(!inFront.gate, "inside the cone → siblings act")
        // particle behind → gated off.
        val behind = s.modify(body, Particle(), Env().apply { vector = Vec3(100f, 0f, 0f); dist = 100f })
        assertTrue(behind.gate, "outside the cone → siblings skipped")
    }

    @Test
    fun screenIsInertInApply() {
        val p = Particle(velocity = Vec3(1f, 2f, 3f))
        ScreenForce().apply(Body(tokens = listOf("screen")), p, Env())
        assertEquals(Vec3(1f, 2f, 3f), p.velocity, "attenuation lives in the integrator, not apply")
    }

    @Test
    fun pigmentStainsMatterOnOverlap() {
        val body = Body(tokens = listOf("pigment"), range = 100f).apply { tint = "#ff0000" }
        val overlapping = Particle()
        PigmentForce().apply(body, overlapping, Env().apply { dist = 10f }) // dist < range·0.6
        assertEquals("#ff0000", overlapping.color, "adopts the body tint on overlap")

        val outside = Particle()
        PigmentForce().apply(body, outside, Env().apply { dist = 80f }) // dist ≥ range·0.6
        assertNull(outside.color, "no stain outside the overlap")
    }

    @Test
    fun fieldFlowSteersOntoAndStreamsDownTheLine() {
        val body = Body(tokens = listOf("fieldflow"), range = 0f, strength = 1f) // global
        val p = Particle(velocity = Vec3(0f, 1f, 0f))
        FieldFlowForce().apply(body, p, Env().apply { c = 12f; fieldAt = { Vec3(1f, 0f, 0f) } })
        // steer (k=0.5): (1,0,0)·1 − (0,1,0) → +(0.5,−0.5,0) ⇒ (0.5,0.5,0); stream +0.12 x ⇒ (0.62,0.5,0)
        assertClose(0.62f, p.velocity.x)
        assertClose(0.5f, p.velocity.y)

        val noField = Particle(velocity = Vec3(0f, 1f, 0f))
        FieldFlowForce().apply(body, noField, Env()) // fieldAt null → inert
        assertEquals(Vec3(0f, 1f, 0f), noField.velocity)
    }

    @Test
    fun warpRelocatesMatterToThePairedThroat() {
        val body = Body(tokens = listOf("warp"), absorbR = 20f).apply {
            warpHas = true
            warpTarget = Vec3(500f, 0f, 0f)
            twist = 0f
            warpScale = 1f
        }
        val p = Particle(velocity = Vec3(0f, 0f, 0f))
        WarpForce().apply(body, p, Env().apply { vector = Vec3(10f, 0f, 0f); dist = 10f }) // within the throat
        // emerge at target + (−entry dir)·(throat·scale + 6) = (500,0,0) + (−1,0,0)·26
        assertClose(474f, p.position.x, msg = "relocated to the paired throat")
        assertClose(0.6f, p.heat)

        // no resolved pair → inert.
        val q = Particle(position = Vec3(7f, 0f, 0f))
        WarpForce().apply(Body(tokens = listOf("warp"), absorbR = 20f), q, Env().apply { vector = Vec3(7f, 0f, 0f); dist = 7f })
        assertEquals(Vec3(7f, 0f, 0f), q.position)
    }
}
