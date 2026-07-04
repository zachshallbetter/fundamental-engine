package com.fundamental.core.recipes

import com.fundamental.core.engine.Body
import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Recipe compiler (recipes/compile.ts, authoring §5) — the Kotlin port of
// swift/Sources/FundamentalCore/Recipes/Compile.swift. Turns a portable FieldRecipe into a runtime
// plan. The lane split is preserved: concepts describe · tokens execute · metrics measure ·
// diagnostics explain · conditions activate. Only the `primitives`/body tokens lane becomes behavior.

/** The feedback lane a metric writes to (`attention` → `field-attention`). */
fun metricVar(metric: String): String = "field-$metric"

/** One compiled body: configured params + runtime tokens; `makeBody()` builds a ready Body. */
data class RecipeBodyRegistration(
    val tokens: List<String>,
    val strength: Float,
    val range: Float,
    val spin: Float,
    val heading: Vec3,
    val feedback: Boolean,
) {
    /** Build a configured Body. Geometry comes later — set `box` or attach a `rect`. */
    fun makeBody(): Body {
        val b = Body(tokens = tokens, strength = strength, range = range, spin = spin, heading = heading)
        b.feedback = feedback
        return b
    }
}

data class RecipeRelationshipRegistration(val from: String, val to: String, val type: String, val strength: Float?)
data class RecipeFeedbackBinding(val metric: String, val variable: String)
data class RecipeReducedMotionPlan(val reducedMotion: String, val meaningWithoutMotion: String, val staticOutputs: List<String>)

/** A compiled recipe — the runtime plan, lanes preserved. */
data class CompiledRecipe(
    val id: String,
    val recipe: FieldRecipe,
    val bodies: List<RecipeBodyRegistration>,
    val relationships: List<RecipeRelationshipRegistration>,
    val feedback: List<RecipeFeedbackBinding>,
    val diagnostics: List<String>,
    val metrics: List<String>,
    val conditions: List<String>,
    val reducedMotion: RecipeReducedMotionPlan,
)

private fun staticOutputs(r: FieldRecipe): List<String> {
    val out = ArrayList<String>()
    if (r.metrics.isNotEmpty()) out.add("metric-badges")
    if (!r.relationships.isNullOrEmpty()) out.add("relationship-list")
    if (r.diagnostics.isNotEmpty()) out.add("inspector-table")
    if (!r.conditions.isNullOrEmpty()) out.add("condition-list")
    out.add("reduced-motion-note")
    return out
}

/** Compile a recipe into a runtime plan (pure). Behavior comes only from the strict token lane. */
fun compileRecipe(r: FieldRecipe): CompiledRecipe = CompiledRecipe(
    id = r.id,
    recipe = r,
    bodies = r.bodies.map { b ->
        val angle = b.angle ?: (-PI.toFloat() / 2f) // the JS default heading: up
        RecipeBodyRegistration(
            tokens = b.body.split(" ").filter { it.isNotEmpty() },
            strength = b.strength ?: 1f,
            range = b.range ?: 100f,
            spin = b.spin ?: 1f,
            heading = Vec3(cos(angle), sin(angle), 0f),
            feedback = b.feedback ?: false,
        )
    },
    relationships = (r.relationships ?: emptyList()).map {
        RecipeRelationshipRegistration(it.from, it.to, it.type, it.strength)
    },
    feedback = r.metrics.map { RecipeFeedbackBinding(it, metricVar(it)) },
    diagnostics = r.diagnostics,
    metrics = r.metrics,
    conditions = r.conditions ?: emptyList(),
    reducedMotion = RecipeReducedMotionPlan(
        reducedMotion = r.accessibility.reducedMotion,
        meaningWithoutMotion = r.accessibility.meaningWithoutMotion,
        staticOutputs = staticOutputs(r),
    ),
)
