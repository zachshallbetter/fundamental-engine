import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// FieldLab for the JVM — a desktop lab + headless snapshot/bench tool over the pure-Kotlin engine.
// The Swift port gets `swift run FieldLab` on macOS for free; this is the Kotlin analog: it reuses the
// exact same :fundamental-core FieldController, renders with Java2D (built into the JDK — no Android,
// no emulator, no Compose-Multiplatform toolchain), and runs anywhere a JVM does.
//
//   ./gradlew :lab:run                          # interactive Swing window (click=burst, keys switch mode)
//   ./gradlew :lab:run --args="render out/"     # headless: render a scene tour to PNGs (CI-able)
//   ./gradlew :lab:run --args="bench"           # headless: report sim ms per scene
plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    application
}

dependencies {
    implementation(project(":fundamental-core"))
    // recipe save/export round-trips a @Serializable FieldRecipe back to the canon JSON shape.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    // JVM unit tests (RecipeExport round-trip). Mirrors :fundamental-core's JUnit 5 setup.
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

tasks.test {
    useJUnitPlatform()
}

application {
    mainClass.set("com.fundamental.lab.MainKt")
}

// Run from the Gradle root (android/), not the module dir, so a relative `render <dir>` resolves the
// same way the CI smoke-check (`ls lab-out/*.png`, run from android/) expects.
tasks.named<JavaExec>("run") {
    workingDir = rootProject.projectDir
}
