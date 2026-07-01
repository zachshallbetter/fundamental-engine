package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBudgets
import com.fundamental.core.engine.FieldPolicy
import com.fundamental.core.engine.effectiveMotion
import com.fundamental.core.engine.policyPermitsBodyData
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// FieldPolicy + budgets (JS #892) — reduced-motion ALWAYS wins and clamps motion to 0; a motion budget
// scales the step; privacy gates body data. Others are declared-not-enforced.

class FieldPolicyTests {

    @Test
    fun effectiveMotionFoldsReducedMotionAndPolicy() {
        // default: unbounded → full motion
        assertEquals(1f, effectiveMotion(FieldPolicy.UNBOUNDED, reducedMotion = false))
        // reduced-motion ALWAYS wins, even against a permissive policy
        assertEquals(0f, effectiveMotion(FieldPolicy(maxMotionBudget = 1f), reducedMotion = true))
        // allowMotionProjection=false pins to 0
        assertEquals(0f, effectiveMotion(FieldPolicy(allowMotionProjection = false), reducedMotion = false))
        // budgets fold via min
        assertEquals(0.25f, effectiveMotion(FieldPolicy(maxMotionBudget = 0.5f, budgets = FieldBudgets(motion = 0.25f)), reducedMotion = false))
        // reduced-motion can only lower, never raise
        assertEquals(0f, effectiveMotion(FieldPolicy(maxMotionBudget = 0.8f), reducedMotion = true))
    }

    @Test
    fun reducedMotionFreezesTheField() {
        val f = createField(800f, 600f, particleCount = 200, seed = 7)
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 2f, range = 900f, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        f.feedReducedMotion(true)
        assertEquals(0f, f.effectiveMotion())
        val before = f.controller.particles.map { it.position.copy() }
        repeat(30) { f.tick() }
        val after = f.controller.particles.map { it.position }
        for (i in before.indices) {
            assertEquals(before[i].x, after[i].x, 1e-4f, "reduced-motion holds position")
            assertEquals(before[i].y, after[i].y, 1e-4f, "reduced-motion holds position")
        }
    }

    @Test
    fun defaultPolicyIsByteIdenticalToNoPolicy() {
        val a = createField(800f, 600f, particleCount = 200, seed = 9)
        val b = createField(800f, 600f, particleCount = 200, seed = 9, policy = FieldPolicy.UNBOUNDED)
        a.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        b.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        repeat(40) { a.tick(); b.tick() }
        val pa = a.controller.particles; val pb = b.controller.particles
        assertEquals(pa.size, pb.size)
        for (i in pa.indices) {
            assertEquals(pa[i].position.x, pb[i].position.x, 1e-5f)
            assertEquals(pa[i].position.y, pb[i].position.y, 1e-5f)
        }
    }

    @Test
    fun privacyGateWithholdsBodyData() {
        assertTrue(policyPermitsBodyData(FieldPolicy.UNBOUNDED))
        assertFalse(policyPermitsBodyData(FieldPolicy(allowBodyDataInSnapshots = false)))
        assertFalse(policyPermitsBodyData(FieldPolicy(budgets = FieldBudgets(privacy = 0.2f))))
        assertTrue(policyPermitsBodyData(FieldPolicy(budgets = FieldBudgets(privacy = 0.9f))))
    }

    @Test
    fun setPolicyReplacesLive() {
        val f = createField(800f, 600f, particleCount = 50, seed = 1)
        assertEquals(1f, f.effectiveMotion())
        f.setPolicy(FieldPolicy(maxMotionBudget = 0.3f))
        assertEquals(0.3f, f.effectiveMotion())
        assertEquals(0.3f, f.policy.maxMotionBudget)
    }
}
