// Root build — declares plugin versions; modules apply them. No Android plugin here:
// the core is pure Kotlin/JVM (zero Android deps), the direct mirror of Swift's FundamentalCore.
plugins {
    kotlin("jvm") version "2.1.0" apply false
    kotlin("plugin.serialization") version "2.1.0" apply false
}
