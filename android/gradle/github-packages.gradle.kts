// Shared GitHub Packages target. Applied by the modules we publish (core, compose).
// Credentials come from the environment so nothing secret is committed:
//   GITHUB_ACTOR (defaults to the repo owner) + GITHUB_TOKEN (needs write:packages).
// Uses configure<PublishingExtension> rather than the `publishing { }` accessor,
// which is not generated for scripts applied via apply(from = …).
configure<org.gradle.api.publish.PublishingExtension> {
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/zachshallbetter/fundamental-engine")
            credentials {
                username = System.getenv("GITHUB_ACTOR") ?: "zachshallbetter"
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
