package com.fundamental.core.recipes

import com.fundamental.core.engine.Body
import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Recipe compiler (recipes/compile.ts, authoring §5) — the Kotlin port of
// swift/Sources/FundamentalCore/Recipes/Compile.swift. Turns a portable FieldPattern into a runtime
// plan. The lane split is preserved: concepts describe · tokens execute · metrics measure ·
// diagnostics explain · conditions activate. Only the `primitives`/body tokens lane becomes behavior.

/** The feedback lane a metric writes to (`attention` → `field-attention`). */
fun metricVar(metric: String): String = "field-$metric"

/** One compiled body: configured params + runtime tokens; `makeBody()` builds a ready Body. */
data class PatternBodyRegistration(
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

data class PatternRelationshipRegistration(val from: String, val to: String, val type: String, val strength: Float?)
data class PatternFeedbackBinding(val metric: String, val variable: String)
data class PatternReducedMotionPlan(val reducedMotion: String, val meaningWithoutMotion: String, val staticOutputs: List<String>)

/** A compiled recipe — the runtime plan, lanes preserved. */
data class CompiledPattern(
    val id: String,
    val recipe: FieldPattern,
    val bodies: List<PatternBodyRegistration>,
    val relationships: List<PatternRelationshipRegistration>,
    val feedback: List<PatternFeedbackBinding>,
    val diagnostics: List<String>,
    val metrics: List<String>,
    val conditions: List<String>,
    val reducedMotion: PatternReducedMotionPlan,
)

private fun staticOutputs(r: FieldPattern): List<String> {
    val out = ArrayList<String>()
    if (r.metrics.isNotEmpty()) out.add("metric-badges")
    if (!r.relationships.isNullOrEmpty()) out.add("relationship-list")
    if (r.diagnostics.isNotEmpty()) out.add("inspector-table")
    if (!r.conditions.isNullOrEmpty()) out.add("condition-list")
    out.add("reduced-motion-note")
    return out
}

/** Compile a recipe into a runtime plan (pure). Behavior comes only from the strict token lane. */
fun compilePattern(r: FieldPattern): CompiledPattern = CompiledPattern(
    id = r.id,
    recipe = r,
    bodies = r.bodies.map { b ->
        val angle = b.angle ?: (-PI.toFloat() / 2f) // the JS default heading: up
        PatternBodyRegistration(
            tokens = b.body.split(" ").filter { it.isNotEmpty() },
            strength = b.strength ?: 1f,
            range = b.range ?: 100f,
            spin = b.spin ?: 1f,
            heading = Vec3(cos(angle), sin(angle), 0f),
            feedback = b.feedback ?: false,
        )
    },
    relationships = (r.relationships ?: emptyList()).map {
        PatternRelationshipRegistration(it.from, it.to, it.type, it.strength)
    },
    feedback = r.metrics.map { PatternFeedbackBinding(it, metricVar(it)) },
    diagnostics = r.diagnostics,
    metrics = r.metrics,
    conditions = r.conditions ?: emptyList(),
    reducedMotion = PatternReducedMotionPlan(
        reducedMotion = r.accessibility.reducedMotion,
        meaningWithoutMotion = r.accessibility.meaningWithoutMotion,
        staticOutputs = staticOutputs(r),
    ),
)

// Deprecated aliases (recipe -> Pattern rename; removed at 1.0)
@Deprecated("Renamed to CompiledPattern", ReplaceWith("CompiledPattern"))
typealias CompiledRecipe = CompiledPattern

@Deprecated("Renamed to compilePattern", ReplaceWith("compilePattern(r)"))
fun compileRecipe(r: FieldPattern): CompiledPattern = compilePattern(r)
