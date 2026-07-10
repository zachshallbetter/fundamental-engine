package com.fundamental.core.recipes

import com.fundamental.core.engine.ForceRegistry
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// FieldPattern schema + validation (recipes/schema.ts) — the Kotlin port of
// swift/Sources/FundamentalCore/Recipes/Schema.swift. A recipe is a portable, inspectable field
// program; the 64-recipe catalog is LOCKED CANON, decoded from the shared data/recipes.json.

val RENDER_LAYER_IDS: Set<String> =
    setOf("particles", "dots", "trails", "links", "streamlines", "metaballs", "voronoi", "field-lines", "heatmap")
val DIAGNOSTIC_MODE_IDS: Set<String> =
    setOf("force-vectors", "contours", "potential", "energy", "topology", "inspector", "causality", "prediction")

/** Every render + diagnostic mode id a recipe may reference. */
val FIELD_MODES: Set<String> = RENDER_LAYER_IDS + DIAGNOSTIC_MODE_IDS
private val VALID_FIELDS: Set<String> = setOf("gravity", "electromagnetic", "strong", "weak")

/** One body in a recipe: a force token (or space-separated tokens) + attributes. */
@Serializable
data class BodyPattern(
    val body: String,
    val strength: Float? = null,
    val range: Float? = null,
    val spin: Float? = null,
    val angle: Float? = null,
    val feedback: Boolean? = null,
    val scope: String? = null,
)

@Serializable
data class RelationshipPattern(val from: String, val to: String, val type: String, val strength: Float? = null)

@Serializable
data class AccessibilityPattern(val reducedMotion: String, val meaningWithoutMotion: String)

/** A portable field recipe (authoring §5). Only `primitives` (runtime tokens) becomes behavior. */
@Serializable
data class FieldPattern(
    val id: String,
    val name: String,
    val intent: String,
    val tier: String? = null,
    val naturalField: String? = null,
    val translation: String? = null,
    val primitives: List<String> = emptyList(),
    val concepts: List<String>? = null,
    val metrics: List<String> = emptyList(),
    val diagnostics: List<String> = emptyList(),
    val conditions: List<String>? = null,
    val bodies: List<BodyPattern> = emptyList(),
    val relationships: List<RelationshipPattern>? = null,
    val render: List<String> = emptyList(),
    val accessibility: AccessibilityPattern,
    val status: String? = null,
    val notes: String? = null,
)

@Serializable
private data class RecipeFile(val count: Int = 0, val recipes: List<FieldPattern> = emptyList())

/** A validation problem: a JSON-ish path + the issue. */
data class PatternProblem(val path: String, val issue: String)

/** The distinct engine primitives across a recipe's bodies, in first-seen order. */
fun primitivesOf(bodies: List<BodyPattern>): List<String> {
    val seen = LinkedHashSet<String>()
    for (b in bodies) for (t in b.body.split(" ")) if (t.isNotEmpty()) seen.add(t)
    return seen.toList()
}

/** Validate a recipe's shape and references against a force registry. Empty = valid. */
fun validatePattern(r: FieldPattern, forces: ForceRegistry): List<PatternProblem> {
    val problems = ArrayList<PatternProblem>()
    if (r.id.isEmpty()) problems.add(PatternProblem("id", "required"))
    if (r.name.isEmpty()) problems.add(PatternProblem("name", "required"))
    if (r.bodies.isEmpty()) problems.add(PatternProblem("bodies", "at least one body is required"))
    r.bodies.forEachIndexed { i, b ->
        val tokens = b.body.split(" ").filter { it.isNotEmpty() }
        if (tokens.isEmpty()) problems.add(PatternProblem("bodies[$i].body", "empty force token list"))
        for (t in tokens) if (!forces.containsKey(t)) problems.add(PatternProblem("bodies[$i].body", "unknown force token \"$t\""))
    }
    val derived = primitivesOf(r.bodies)
    val declared = r.primitives
    if (declared.size != derived.size || derived.any { it !in declared } || declared.any { it !in derived }) {
        problems.add(PatternProblem("primitives", "must list exactly the body tokens (expected: ${derived.joinToString(", ")})"))
    }
    r.render.forEachIndexed { i, layer -> if (layer !in RENDER_LAYER_IDS) problems.add(PatternProblem("render[$i]", "unknown render layer \"$layer\"")) }
    r.diagnostics.forEachIndexed { i, mode -> if (mode !in FIELD_MODES) problems.add(PatternProblem("diagnostics[$i]", "unknown diagnostic mode \"$mode\"")) }
    r.naturalField?.let { if (it !in VALID_FIELDS) problems.add(PatternProblem("naturalField", "unknown fundamental field \"$it\"")) }
    if (r.accessibility.reducedMotion.isEmpty() || r.accessibility.meaningWithoutMotion.isEmpty()) {
        problems.add(PatternProblem("accessibility", "reducedMotion + meaningWithoutMotion are required (no recipe is motion-only)"))
    }
    return problems
}

/** The locked 64-recipe catalog (4 tiers × 16), decoded from the embedded shared canon. */
object FieldPatterns {
    private val json = Json { ignoreUnknownKeys = true }

    val all: List<FieldPattern> by lazy {
        val stream = FieldPatterns::class.java.getResourceAsStream("/recipes.json")
            ?: error("FundamentalCore: bundled recipes.json is missing (the syncRecipes Gradle task pulls it in)")
        val text = stream.bufferedReader().use { it.readText() }
        json.decodeFromString(RecipeFile.serializer(), text).recipes
    }

    fun recipe(id: String): FieldPattern? = all.firstOrNull { it.id == id }
    fun recipes(tier: String): List<FieldPattern> = all.filter { it.tier == tier }
}

// Deprecated aliases (recipe -> Pattern rename; removed at 1.0)
@Deprecated("Renamed to FieldPattern", ReplaceWith("FieldPattern"))
typealias FieldRecipe = FieldPattern

@Deprecated("Renamed to FieldPatterns", ReplaceWith("FieldPatterns"))
typealias FieldRecipes = FieldPatterns
