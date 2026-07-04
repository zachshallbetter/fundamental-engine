package com.fundamental.core

import com.fundamental.core.engine.Registry
import com.fundamental.core.recipes.FieldRecipes
import com.fundamental.core.recipes.compileRecipe
import com.fundamental.core.recipes.validateRecipe
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The locked 64-recipe canon — decoded from the shared data/recipes.json and held to the same
// validity gate as Swift: every recipe validates against the standard registry, and every body token
// is a real registered force.

class RecipeTests {
    private val forces = Registry.standardForces()

    @Test
    fun theCanonLoadsAll64() {
        assertEquals(64, FieldRecipes.all.size, "the locked catalog is 64 recipes")
    }

    @Test
    fun everyRecipeValidatesAgainstTheStandardRegistry() {
        val failures = StringBuilder()
        for (r in FieldRecipes.all) {
            val problems = validateRecipe(r, forces)
            if (problems.isNotEmpty()) failures.append("\n${r.id}: ${problems.joinToString("; ") { "${it.path} — ${it.issue}" }}")
        }
        assertTrue(failures.isEmpty(), "every canon recipe must validate:$failures")
    }

    @Test
    fun everyBodyTokenIsARegisteredForce() {
        for (r in FieldRecipes.all) {
            for (b in r.bodies) {
                for (t in b.body.split(" ").filter { it.isNotEmpty() }) {
                    assertTrue(forces.containsKey(t), "recipe ${r.id} references unknown force '$t'")
                }
            }
        }
    }

    @Test
    fun compileProducesRunnableBodies() {
        val r = FieldRecipes.all.first { it.bodies.isNotEmpty() }
        val compiled = compileRecipe(r)
        assertEquals(r.bodies.size, compiled.bodies.size)
        assertTrue(compiled.bodies.all { it.tokens.isNotEmpty() }, "every compiled body carries tokens")
        // a metric becomes a feedback binding (field-<metric>)
        if (r.metrics.isNotEmpty()) {
            assertEquals("field-${r.metrics[0]}", compiled.feedback[0].variable)
        }
    }

    @Test
    fun fourTiersAreRepresented() {
        val tiers = FieldRecipes.all.mapNotNull { it.tier }.toSet()
        assertTrue(tiers.containsAll(setOf("core", "applied", "systems", "operational")), "all four tiers present (got $tiers)")
    }
}
