import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// @fundamental-engine/vanilla's Android counterpart — the imperative View/Canvas host (mirror of
// Swift's UIKitFieldHost). A non-Compose FieldView (a custom android.view.View) that owns a
// FieldController, drives it from the Choreographer, and renders the pool in onDraw. For apps that
// aren't on Compose. Thin host over the pure-Kotlin :fundamental-core.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fundamental.android"
    compileSdk = 34
    buildToolsVersion = "34.0.0"

    defaultConfig {
        minSdk = 24
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    api(project(":fundamental-core"))
    implementation("androidx.core:core-ktx:1.13.1")
}
