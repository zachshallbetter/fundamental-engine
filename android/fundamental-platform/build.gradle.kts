import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// @fundamental-engine/dom, in Kotlin (mirror of Swift's FundamentalPlatform). The six-phase frame
// scheduler + the registries. Pure JVM — no Android imports — so it builds on the cheap CI runner and
// stays host-agnostic; the Android host (Compose) implements the injected FieldHost seam.
plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":fundamental-core"))
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

tasks.withType<Test> { useJUnitPlatform() }
