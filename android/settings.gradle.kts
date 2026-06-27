// Fundamental for Android — the native Kotlin port of the reciprocal field engine.
// Mirror of swift/Package.swift: a platform-free core module today, Android host modules to follow.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        mavenCentral()
    }
}

rootProject.name = "fundamental-android"

include(":fundamental-core")
