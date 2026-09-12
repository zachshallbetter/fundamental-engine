// Root build — declares plugin versions; modules apply them. The core stays pure Kotlin/JVM (zero
// Android deps, the mirror of Swift's FundamentalCore); the Android library + sample + Compose plugins
// are declared here and applied only by the host modules.
plugins {
    kotlin("jvm") version "2.1.0" apply false
    kotlin("plugin.serialization") version "2.1.0" apply false
    id("com.android.library") version "8.7.3" apply false
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
}

// Coordinates for the published Android/JVM artifacts (GitHub Packages). Mirrors the
// npm scope @fundamental-engine and the Swift package products.
//
// The version is DERIVED, never typed: CI passes -PreleaseVersion=<tag without the v> on a
// release tag, so the published version always equals the git tag and can never silently
// overwrite a prior release with different code. A local build with no property is a SNAPSHOT,
// which GitHub Packages will not mistake for a release.
subprojects {
    group = "com.fundamental"
    version = (findProperty("releaseVersion") as String?) ?: "0.0.0-SNAPSHOT"
}

// ── Maven Central (Sonatype Central Portal) — bundle + opt-in upload ─────────────────────────────
// The modules publish into ONE local staging tree (build/central-staging, a Maven-layout directory —
// see gradle/maven-central.gradle.kts). These root tasks turn it into the Portal's upload bundle
// and, ONLY when explicitly invoked, upload it via the Publisher API:
//
//   ./gradlew centralBundle -PreleaseVersion=X.Y.Z   # stage + sign + zip; prints the manifest. NO network.
//   ./gradlew centralUpload -PreleaseVersion=X.Y.Z   # the only task that talks to central.sonatype.com
//   ./gradlew centralStatus -PcentralDeploymentId=…  # poll a deployment's validation state
//
// Upload auth: MAVEN_CENTRAL_USERNAME / MAVEN_CENTRAL_PASSWORD (a Portal user token, never a login
// password), sent as `Bearer base64(user:token)` per the Publisher API. Signing key: SIGNING_KEY.
// Default publishing type is USER_MANAGED — the deployment is validated and then waits for a human
// to press "Publish" in the Portal; pass -PcentralPublishingType=AUTOMATIC to publish on validation.
val centralStaging = layout.buildDirectory.dir("central-staging")
val releaseVersion = (findProperty("releaseVersion") as String?) ?: "0.0.0-SNAPSHOT"
val centralApi = "https://central.sonatype.com/api/v1/publisher"

val centralClean by tasks.registering(Delete::class) {
    group = "publishing"
    description = "Empty the Maven Central staging tree so a bundle never carries a stale version."
    delete(centralStaging)
}

val centralBundle by tasks.registering(Zip::class) {
    group = "publishing"
    description = "Stage core + compose into the local Central tree and zip it as the Portal upload bundle (no upload)."
    dependsOn(
        ":fundamental-core:publishAllPublicationsToCentralStagingRepository",
        ":fundamental-compose:publishAllPublicationsToCentralStagingRepository",
    )
    from(centralStaging) {
        // maven-metadata.xml is repository state, not a deployment artifact — the Portal wants only the GAV tree.
        exclude("**/maven-metadata.*")
    }
    archiveFileName.set("fundamental-android-$releaseVersion-central-bundle.zip")
    destinationDirectory.set(layout.buildDirectory.dir("central"))
    doLast {
        val bundle = archiveFile.get().asFile
        val entries = java.util.zip.ZipFile(bundle).use { zip -> zip.entries().asSequence().filter { !it.isDirectory }.map { it.name to it.size }.toList() }
        println("── Maven Central bundle: ${bundle.absolutePath} (${bundle.length()} bytes, ${entries.size} files) ──")
        entries.sortedBy { it.first }.forEach { (name, size) -> println("  %10d  %s".format(size, name)) }
        val signed = entries.count { it.first.endsWith(".asc") }
        println("── signatures: $signed .asc files ${if (signed == 0) "(UNSIGNED — set SIGNING_KEY; centralUpload will refuse this bundle)" else ""}")
        println("── version: $releaseVersion ${if (releaseVersion.endsWith("-SNAPSHOT")) "(SNAPSHOT — Central rejects snapshots; pass -PreleaseVersion=X.Y.Z)" else ""}")
    }
}

val centralUpload by tasks.registering {
    group = "publishing"
    description = "Upload the Central bundle to the Sonatype Central Portal (Publisher API). Opt-in; needs MAVEN_CENTRAL_USERNAME/PASSWORD."
    dependsOn(centralBundle)
    doLast {
        val bundle = centralBundle.get().archiveFile.get().asFile
        check(!releaseVersion.endsWith("-SNAPSHOT")) { "refusing to upload a SNAPSHOT ($releaseVersion): pass -PreleaseVersion=X.Y.Z" }
        val names = java.util.zip.ZipFile(bundle).use { zip -> zip.entries().asSequence().map { it.name }.toList() }
        check(names.any { it.endsWith(".pom.asc") }) { "refusing to upload an UNSIGNED bundle: set SIGNING_KEY / SIGNING_PASSWORD" }
        check(names.any { it.endsWith("-sources.jar") } && names.any { it.endsWith("-javadoc.jar") }) { "bundle is missing -sources/-javadoc jars" }
        val user = System.getenv("MAVEN_CENTRAL_USERNAME")?.takeIf { it.isNotBlank() }
            ?: error("MAVEN_CENTRAL_USERNAME is not set (a Central Portal user-token username)")
        val pass = System.getenv("MAVEN_CENTRAL_PASSWORD")?.takeIf { it.isNotBlank() }
            ?: error("MAVEN_CENTRAL_PASSWORD is not set (the matching user-token password)")
        val publishingType = (findProperty("centralPublishingType") as String?) ?: "USER_MANAGED"
        require(publishingType in setOf("USER_MANAGED", "AUTOMATIC")) { "centralPublishingType must be USER_MANAGED or AUTOMATIC" }
        val bearer = java.util.Base64.getEncoder().encodeToString("$user:$pass".toByteArray())

        val boundary = "----fundamental-${System.nanoTime()}"
        val head = ("--$boundary\r\nContent-Disposition: form-data; name=\"bundle\"; filename=\"${bundle.name}\"\r\n" +
            "Content-Type: application/octet-stream\r\n\r\n").toByteArray()
        val tail = "\r\n--$boundary--\r\n".toByteArray()
        val body = java.io.ByteArrayOutputStream().apply { write(head); write(bundle.readBytes()); write(tail) }.toByteArray()
        val deploymentName = "fundamental-android-$releaseVersion"
        val uri = java.net.URI("$centralApi/upload?name=$deploymentName&publishingType=$publishingType")
        val request = java.net.http.HttpRequest.newBuilder(uri)
            .header("Authorization", "Bearer $bearer")
            .header("Content-Type", "multipart/form-data; boundary=$boundary")
            .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(body))
            .build()
        println("uploading ${bundle.name} (${bundle.length()} bytes) → $uri")
        val response = java.net.http.HttpClient.newHttpClient().send(request, java.net.http.HttpResponse.BodyHandlers.ofString())
        check(response.statusCode() in 200..299) { "Central Portal upload failed: HTTP ${response.statusCode()} ${response.body()}" }
        println("deployment id: ${response.body().trim()}  (publishingType=$publishingType)")
        println("check it: ./gradlew centralStatus -PcentralDeploymentId=${response.body().trim()}  — or https://central.sonatype.com/publishing/deployments")
    }
}

val centralStatus by tasks.registering {
    group = "publishing"
    description = "Print the validation state of a Central Portal deployment (-PcentralDeploymentId=<uuid>)."
    doLast {
        val id = (findProperty("centralDeploymentId") as String?) ?: error("pass -PcentralDeploymentId=<uuid> (printed by centralUpload)")
        val user = System.getenv("MAVEN_CENTRAL_USERNAME") ?: error("MAVEN_CENTRAL_USERNAME is not set")
        val pass = System.getenv("MAVEN_CENTRAL_PASSWORD") ?: error("MAVEN_CENTRAL_PASSWORD is not set")
        val bearer = java.util.Base64.getEncoder().encodeToString("$user:$pass".toByteArray())
        val request = java.net.http.HttpRequest.newBuilder(java.net.URI("$centralApi/status?id=$id"))
            .header("Authorization", "Bearer $bearer")
            .POST(java.net.http.HttpRequest.BodyPublishers.noBody())
            .build()
        val response = java.net.http.HttpClient.newHttpClient().send(request, java.net.http.HttpResponse.BodyHandlers.ofString())
        println("HTTP ${response.statusCode()}\n${response.body()}")
    }
}
