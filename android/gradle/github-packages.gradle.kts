// Shared GitHub Packages target. Applied by the modules we publish (core, compose).
// Credentials come from Gradle properties, android/gpr.key, or the environment so
// nothing secret is committed:
//   gpr.user/gpr.key, GITHUB_ACTOR (defaults to repo owner), GITHUB_TOKEN.
// Uses configure<PublishingExtension> rather than the `publishing { }` accessor,
// which is not generated for scripts applied via apply(from = …).
val gprKeyFromFile = rootProject.rootDir.resolve("gpr.key")
    .takeIf { it.exists() }
    ?.readText()
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
configure<org.gradle.api.publish.PublishingExtension> {
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/zachshallbetter/fundamental-engine")
            credentials {
                username = (findProperty("gpr.user") as String?) ?: System.getenv("GITHUB_ACTOR") ?: "zachshallbetter"
                password = (findProperty("gpr.key") as String?) ?: gprKeyFromFile ?: System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
