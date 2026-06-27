// Fundamental for Android — the native Kotlin port of the reciprocal field engine.
// Mirror of swift/Package.swift: a platform-free core module today, Android host modules to follow.
pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "fundamental-android"

include(":fundamental-core")
include(":fundamental-compose")
include(":sample")
include(":lab")
