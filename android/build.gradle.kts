// Root build — declares plugin versions; modules apply them. The core stays pure Kotlin/JVM (zero
// Android deps, the mirror of Swift's FundamentalCore); the Android library + sample + Compose plugins
// are declared here and applied only by the host modules.
plugins {
    kotlin("jvm") version "2.1.0" apply false
    kotlin("plugin.serialization") version "2.1.0" apply false
    id("com.android.library") version "8.7.3" apply false
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
}

// Coordinates for the published Android/JVM artifacts (GitHub Packages). Mirrors the
// npm scope @fundamental-engine and the Swift package products.
//
// The version is DERIVED, never typed: CI passes -PreleaseVersion=<tag without the v> on a
// release tag, so the published version always equals the git tag and can never silently
// overwrite a prior release with different code. A local build with no property is a SNAPSHOT,
// which GitHub Packages will not mistake for a release.
subprojects {
    group = "com.fundamental"
    version = (findProperty("releaseVersion") as String?) ?: "0.0.0-SNAPSHOT"
}
