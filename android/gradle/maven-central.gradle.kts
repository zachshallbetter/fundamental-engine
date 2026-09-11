// Shared Maven Central (Sonatype Central Portal) target. Applied by the modules we publish
// (core, compose) ALONGSIDE github-packages.gradle.kts — GitHub Packages stays intact.
//
// What this adds to every MavenPublication in the applying module:
//   • the POM metadata Central validates (name, description, url, MIT license, developers, scm);
//   • GPG signing of every artifact + the POM, from an IN-MEMORY key read from the environment
//     (SIGNING_KEY = ASCII-armored private key, SIGNING_PASSWORD, optional SIGNING_KEY_ID) —
//     nothing secret is ever committed, and with no key set the build is simply unsigned
//     (publishToMavenLocal keeps working; the root `centralUpload` refuses an unsigned bundle);
//   • a "CentralStaging" repository that is a LOCAL directory (android/build/central-staging),
//     laid out exactly as the Portal expects. Publishing here never touches the network. The
//     root project zips it into the upload bundle (`centralBundle`) and only `centralUpload`
//     — never run by default — talks to central.sonatype.com.
//     The repository is registered ONLY when a `central*` task was requested on the command line,
//     so the plain `publish` that android.yml runs on a release tag keeps exactly today's task
//     graph (GitHub Packages only) — the two targets never interfere.
//
// The module sets `extra["pomName"]` / `extra["pomDescription"]` before applying this script.
// Uses configure<…> rather than the type-safe accessors, which are not generated for scripts
// applied via apply(from = …).
apply(plugin = "signing")

val pomName = (extra.properties["pomName"] as String?) ?: "Fundamental ${project.name}"
val pomDescription = (extra.properties["pomDescription"] as String?)
    ?: "The Fundamental reciprocal field engine — Kotlin port."
val repoUrl = "https://github.com/zachshallbetter/fundamental-engine"

// `./gradlew centralBundle`, `centralUpload`, or an explicit `publish…ToCentralStagingRepository`.
val centralRequested = gradle.startParameter.taskNames.any { it.contains("central", ignoreCase = true) }

configure<org.gradle.api.publish.PublishingExtension> {
    if (centralRequested) {
        repositories {
            maven {
                name = "CentralStaging"
                url = uri(rootProject.layout.buildDirectory.dir("central-staging"))
            }
        }
    }
    publications.withType<MavenPublication>().configureEach {
        pom {
            name.set(pomName)
            description.set(pomDescription)
            url.set("https://fundamental-engine.com")
            licenses {
                license {
                    name.set("MIT License")
                    url.set("$repoUrl/blob/main/LICENSE")
                    distribution.set("repo")
                }
            }
            developers {
                developer {
                    id.set("zachshallbetter")
                    name.set("Zach Shallbetter")
                    url.set("https://github.com/zachshallbetter")
                }
            }
            scm {
                connection.set("scm:git:$repoUrl.git")
                developerConnection.set("scm:git:ssh://git@github.com/zachshallbetter/fundamental-engine.git")
                url.set(repoUrl)
            }
        }
    }
}

// ── Signing (in-memory key from the environment; skipped entirely when absent) ──────────────────
val signingKey: String? = System.getenv("SIGNING_KEY")?.takeIf { it.isNotBlank() }
val signingPassword: String? = System.getenv("SIGNING_PASSWORD")
val signingKeyId: String? = System.getenv("SIGNING_KEY_ID")?.takeIf { it.isNotBlank() }

if (signingKey != null) {
    configure<org.gradle.plugins.signing.SigningExtension> {
        if (signingKeyId != null) {
            useInMemoryPgpKeys(signingKeyId, signingKey, signingPassword)
        } else {
            useInMemoryPgpKeys(signingKey, signingPassword)
        }
        // live collection: the compose publication is created in afterEvaluate and is still signed.
        sign(the<org.gradle.api.publish.PublishingExtension>().publications)
    }
} else {
    gradle.taskGraph.whenReady {
        if (allTasks.any { it.project == project && it.name.endsWith("ToCentralStagingRepository") }) {
            logger.warn("[maven-central] ${project.path}: SIGNING_KEY is not set — staging UNSIGNED artifacts (fine for a dry run; centralUpload will refuse them).")
        }
    }
}

// A fresh staging tree per publish, so a bundle can never carry a stale version alongside the new one.
tasks.matching { it.name.endsWith("ToCentralStagingRepository") }.configureEach {
    dependsOn(":centralClean")
}
