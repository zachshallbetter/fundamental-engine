package com.fundamental.lab

import com.fundamental.core.recipes.AccessibilityPattern
import com.fundamental.core.recipes.BodyPattern
import com.fundamental.core.recipes.FieldPattern
import com.fundamental.core.recipes.RelationshipPattern
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

// RecipeExport — the FieldLab "export the current recipe" action. A @Serializable FieldPattern value
// must round-trip: RecipeExport.toJson(it) → decode → an EQUAL recipe. Default-valued fields are
// omitted from the bytes (encodeDefaults = false), so this checks the *value* survives, not the bytes.
// Built from a minimal hand-authored recipe so the test carries no resource/classpath dependency on
// the synced data/recipes.json canon (which only :fundamental-core puts on the classpath).

class RecipeExportTests {

    // A plain decoder: tolerant of missing keys (the omitted defaults), strict on shape otherwise.
    private val json = Json { ignoreUnknownKeys = true }

    private fun minimalRecipe(): FieldPattern = FieldPattern(
        id = "test-orbit",
        name = "Test Orbit",
        intent = "verify the export round-trip",
        tier = "atom",
        naturalField = "gravity",
        primitives = listOf("attract", "spin"),
        metrics = listOf("density"),
        diagnostics = listOf("force-vectors"),
        bodies = listOf(
            BodyPattern(body = "attract", strength = 1.6f, range = 260f),
            BodyPattern(body = "spin", spin = 2f, angle = 90f),
        ),
        relationships = listOf(RelationshipPattern(from = "attract", to = "spin", type = "drives", strength = 0.5f)),
        render = listOf("dots", "trails"),
        accessibility = AccessibilityPattern(
            reducedMotion = "freeze the orbit",
            meaningWithoutMotion = "the ring still reads as a relationship",
        ),
    )

    @Test
    fun toJsonRoundTripsToAnEqualRecipe() {
        val original = minimalRecipe()
        val text = RecipeExport.toJson(original)
        val decoded = json.decodeFromString(FieldPattern.serializer(), text)
        assertEquals(original, decoded, "the decoded recipe equals the original")
    }

    @Test
    fun roundTripPreservesIdNamePrimitivesBodiesAndRender() {
        val original = minimalRecipe()
        val decoded = json.decodeFromString(FieldPattern.serializer(), RecipeExport.toJson(original))
        assertEquals(original.id, decoded.id, "id preserved")
        assertEquals(original.name, decoded.name, "name preserved")
        assertEquals(original.primitives, decoded.primitives, "primitives preserved")
        assertEquals(original.bodies, decoded.bodies, "bodies preserved")
        assertEquals(original.render, decoded.render, "render preserved")
        assertEquals(original.relationships, decoded.relationships, "relationships preserved")
        assertEquals(original.accessibility, decoded.accessibility, "accessibility preserved")
    }
}
