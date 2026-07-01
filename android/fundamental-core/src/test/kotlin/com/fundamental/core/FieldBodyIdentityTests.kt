package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldController
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// FIRST-CLASS IDENTITY (JS #884) — stable, structured body identity resolved deterministically
// (supplied → resolver → `body-N`; NEVER random) and cached for the body's life.

class FieldBodyIdentityTests {

    @Test
    fun suppliedIdentityWins() {
        val f = createField(800f, 600f, particleCount = 20, seed = 1)
        val ident = FieldBodyIdentity(id = "hero", namespace = "home", kind = "heading", host = "compose")
        val h = f.addBody(BodySpec(tokens = listOf("attract"), identity = ident, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        assertEquals(ident, h.identity)
        assertEquals("hero", h.identity.id)
        assertEquals("home", h.identity.namespace)
    }

    @Test
    fun derivedIdentityIsStableAndDeterministic() {
        val c = FieldController(800f, 600f, particleCount = 20, seed = 1)
        val a = Body(tokens = listOf("attract")).also { it.box = Box(center = Vec3(100f, 100f, 0f)) }
        val b = Body(tokens = listOf("attract")).also { it.box = Box(center = Vec3(200f, 200f, 0f)) }
        val idA1 = c.bodyIdentity(a)
        val idB1 = c.bodyIdentity(b)
        assertEquals("body-0", idA1.id)
        assertEquals("body-1", idB1.id)
        // stable across re-keying (cached on the body, never re-derived)
        assertEquals(idA1, c.bodyIdentity(a))
        assertTrue(idA1.id != idB1.id, "each body gets a distinct id")
    }

    @Test
    fun resolverTakesPrecedenceOverSyntheticButNotOverSupplied() {
        val c = FieldController(800f, 600f, particleCount = 20, seed = 1)
        c.identify = { body -> body.tint?.let { FieldBodyIdentity(id = "tint-$it") } }
        val resolved = Body(tokens = listOf("attract")).also { it.tint = "red" }
        assertEquals("tint-red", c.bodyIdentity(resolved).id)
        // resolver returns null → falls back to `body-N`
        val fallback = Body(tokens = listOf("attract"))
        assertEquals("body-0", c.bodyIdentity(fallback).id)
        // supplied identity beats the resolver
        val supplied = Body(tokens = listOf("attract")).also {
            it.tint = "blue"; it.identity = FieldBodyIdentity(id = "explicit")
        }
        assertEquals("explicit", c.bodyIdentity(supplied).id)
    }

    @Test
    fun createFieldThreadsTheResolver() {
        val f = createField(800f, 600f, particleCount = 20, seed = 1, identify = { FieldBodyIdentity(id = "resolved") })
        val h = f.addBody(BodySpec(tokens = listOf("attract"), rect = { Box(center = Vec3(400f, 300f, 0f)) }))
        assertNotNull(h.identity)
        assertEquals("resolved", h.identity.id)
    }
}
