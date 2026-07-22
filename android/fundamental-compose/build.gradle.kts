import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// @fundamental-engine/react's Android counterpart — the Jetpack Compose adapter. A thin host over the
// pure-Kotlin :fundamental-core: FieldView renders the field, Modifier.fieldBody makes a composable a body.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    `maven-publish`
}

android {
    publishing { singleVariant("release") }
    namespace = "com.fundamental.compose"
    compileSdk = 34
    buildToolsVersion = "34.0.0"

    defaultConfig {
        minSdk = 24
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    api(project(":fundamental-core"))

    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    // LocalLifecycleOwner (its post-compose-1.7 home) — the lifecycle-driven auto-pause seam (#605 mirror).
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.core:core-ktx:1.13.1")
}

// ── Publishing ──────────────────────────────────────────────────────────────
apply(from = rootProject.file("gradle/github-packages.gradle.kts"))
afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])   // AGP's release AAR + POM (transitive core dep included)
                artifactId = "fundamental-compose"
            }
        }
    }
}
