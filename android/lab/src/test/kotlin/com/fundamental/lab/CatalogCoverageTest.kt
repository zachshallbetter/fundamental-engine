package com.fundamental.lab

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The gate that makes the generated/hand-written split safe (#1186).
 *
 * `token`/`label`/`group` come from the JS passport via GeneratedForceCatalog.kt; `blurb` is
 * hand-written in Catalog.kt. That is only sound if the two halves cannot drift apart — which is
 * exactly what went wrong before this file existed: `relief` shipped on three planes and never
 * appeared in the Kotlin catalog, and `fieldflow` drifted to the label "Field Flow".
 */
class CatalogCoverageTest {

    @Test
    fun `every generated force has a blurb`() {
        val missing = GENERATED_FORCES.map { it.token }.filter { ForceCatalog.blurbs[it].isNullOrBlank() }
        assertTrue(
            missing.isEmpty(),
            "forces generated from the passport with no blurb in Catalog.kt: $missing — add one, do not delete the force",
        )
    }

    @Test
    fun `no blurb is left behind for a force that no longer exists`() {
        val known = GENERATED_FORCES.map { it.token }.toSet()
        val orphaned = ForceCatalog.blurbs.keys.filterNot { it in known }
        assertTrue(orphaned.isEmpty(), "blurbs for tokens absent from the generated catalog: $orphaned")
    }

    @Test
    fun `entries mirror the generated catalog exactly`() {
        assertEquals(GENERATED_FORCES.size, ForceCatalog.entries.size)
        assertEquals(GENERATED_FORCES.map { it.token }, ForceCatalog.entries.map { it.token })
        assertEquals(GENERATED_FORCES.map { it.label }, ForceCatalog.entries.map { it.label })
    }

    @Test
    fun `the groups the sidebar renders cover every force`() {
        val ungrouped = ForceCatalog.entries.filterNot { it.group in ForceCatalog.groups }
        assertTrue(ungrouped.isEmpty(), "forces whose group is not a sidebar group: ${ungrouped.map { it.token to it.group }}")
    }
}
