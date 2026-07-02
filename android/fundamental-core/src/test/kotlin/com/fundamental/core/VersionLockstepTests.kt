package com.fundamental.core

import com.fundamental.core.runtime.FIELD_VERSION
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

// Drift guard (#923) — the Kotlin mirror of the JS `version.test.ts` (#693). FIELD_VERSION is the
// snapshot-format version stamped onto every capture; it MUST equal the canonical engine version,
// which is the JS core's package version (`packages/core/package.json` — the release bump is the
// single source of truth). The file reaches the test classpath via the `syncCoreVersion` Gradle task
// (same mechanism as the cross-plane golden), so this test fails the build if a release bumps the
// packages but leaves the Kotlin port's constant stale — otherwise snapshots would silently record
// the wrong format version.

@Serializable
private data class CorePackageJson(val version: String)

class VersionLockstepTests {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun fieldVersionMatchesCorePackageJson() {
        val stream = javaClass.getResourceAsStream("/version/package.json")
            ?: error("packages/core/package.json missing on the classpath — Gradle's syncCoreVersion task pulls it in")
        val text = stream.bufferedReader().use { it.readText() }
        val pkg = json.decodeFromString(CorePackageJson.serializer(), text)
        assertEquals(
            pkg.version,
            FIELD_VERSION,
            "update FIELD_VERSION in android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldSnapshot.kt to match the release",
        )
    }
}
