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
