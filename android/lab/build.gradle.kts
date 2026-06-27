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
    application
}

dependencies {
    implementation(project(":fundamental-core"))
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

application {
    mainClass.set("com.fundamental.lab.MainKt")
}
