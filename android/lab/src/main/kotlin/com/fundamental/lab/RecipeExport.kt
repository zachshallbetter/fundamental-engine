package com.fundamental.lab

import com.fundamental.core.recipes.FieldPattern
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Recipe save/export — the FieldLab "export the current recipe" action. `FieldPattern` is
 * `@Serializable`, so a recipe *value* round-trips: decoding the export reproduces an equal
 * `FieldPattern` (default-valued fields are omitted, so the bytes need not match the canon's
 * `data/recipes.json` exactly). Mirror of the Swift FieldLab's recipe export.
 */
object RecipeExport {
    private val json = Json { prettyPrint = true; encodeDefaults = false }

    /** Serialize a recipe to canonical pretty JSON. */
    fun toJson(recipe: FieldPattern): String = json.encodeToString(recipe)

    /** Write a recipe to [file] as JSON (creating parent dirs); returns the file written. */
    fun write(recipe: FieldPattern, file: File): File {
        file.parentFile?.mkdirs()
        file.writeText(toJson(recipe))
        return file
    }

    /** A safe default filename for a recipe (`recipe-<id>.json`). */
    fun defaultFileName(recipe: FieldPattern): String =
        "recipe-${recipe.id.ifBlank { recipe.name }}.json".replace(Regex("[^A-Za-z0-9._-]"), "_")
}
