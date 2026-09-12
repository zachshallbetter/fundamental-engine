# Publishing

The six `@fundamental-engine/*` packages publish to npm **with provenance** via CI. This document is the
mechanics; the policy (versioning, when to cut) is in [`RELEASING.md`](RELEASING.md).

> A listed subset of the public surface is protected from silent removal — see
> [API stability](docs/canonical/api-stability.md). `pnpm check:api` (run in CI and the
> release workflow) fails if a protected symbol disappears, so an export cannot vanish from a release by accident.

## The packages

| npm name | role |
|---|---|
| `@fundamental-engine/core` | the engine (no workspace deps) |
| `@fundamental-engine/dom` | the web host adapter; depends on core |
| `@fundamental-engine/vanilla` | framework-free door; depends on core + dom |
| `@fundamental-engine/react` | React adapter; depends on core + dom |
| `@fundamental-engine/elements` | web components; depends on core + dom + vanilla |
| `@fundamental-engine/three` | Three.js adapter; depends on core (`three` as a peer dep) |

All carry `publishConfig.access: public`, so the scoped names publish publicly. `pnpm` rewrites
`workspace:*` to the real version at pack time and publishes in dependency order automatically — never
use raw `npm publish`, which leaks the `workspace:` protocol into the tarball.

## The normal path: push a tag

Releases publish from CI, not a laptop — that's the only way to get **provenance** (it needs the GitHub
OIDC token). Per [`RELEASING.md`](RELEASING.md): bump versions, commit, then push a `v*` tag:

```sh
git tag -a vX.Y.Z -m "Release X.Y.Z" && git push origin vX.Y.Z
```

This triggers [`.github/workflows/release.yml`](.github/workflows/release.yml): full gate →
`pnpm --filter "./packages/*" publish --access public --no-git-checks --provenance`. A failed publish can
be retried without re-tagging: `gh run rerun <run-id> --failed`.

### Prerequisites (all currently satisfied)

- The GitHub repo is **public** — npm refuses provenance for private repos (`E422 … visibility:
  "private"`).
- The `NPM_TOKEN` repo secret is a **granular** npm token with read+write to `@fundamental-engine` and
  **"Bypass two-factor authentication" enabled**. A classic/publish token fails in CI with `EOTP`
  (the account is 2FA `auth-and-writes`, and CI can't answer an OTP prompt).
- The workflow has `permissions: id-token: write` (for the provenance attestation).

## Manual fallback (no provenance)

Only if CI is unavailable. This publishes **without** provenance and needs an OTP each run:

```sh
pnpm -r build && pnpm test && pnpm check:dist && pnpm check:api   # gate
pnpm --filter "./packages/*" publish --access public --no-git-checks --otp=<code>
```

## Kotlin (Android) artifacts

The Kotlin port publishes two Maven artifacts — `com.fundamental:fundamental-core` (jar) and
`com.fundamental:fundamental-compose` (AAR) — at the same tag-derived version as npm and SPM
(`-PreleaseVersion=<tag without the v>`; a build without the property is `0.0.0-SNAPSHOT`). Both carry
`-sources` and `-javadoc` jars and a full POM. Details: [`android/README.md`](android/README.md#publishing).

### Today: GitHub Packages (live)

The `publish` job in [`.github/workflows/android.yml`](.github/workflows/android.yml) runs on every `v*` tag:
`./gradlew :fundamental-core:publish :fundamental-compose:publish -PreleaseVersion=X.Y.Z`, authenticated
with the Actions `GITHUB_TOKEN`. Nothing to create. The cost is on the consumer: GitHub Packages requires a
read token (`android/gpr.key`) even for public packages (#1092).

### Prepared: Maven Central (Sonatype Central Portal)

Everything on the repo side is in place — `android/gradle/maven-central.gradle.kts` (POM metadata Central
validates: name, description, url, MIT license, developer, scm; GPG signing from an **in-memory** key; a
local `CentralStaging` repository), the root tasks `centralBundle` / `centralUpload` / `centralStatus`, and the
dispatch-only, dry-run-by-default [`.github/workflows/maven-central.yml`](.github/workflows/maven-central.yml).
`centralBundle` stages, signs, and zips the Portal bundle **without touching the network**; `centralUpload` is
the only task that talks to `central.sonatype.com`, and it refuses a `-SNAPSHOT` or an unsigned bundle. What
remains is one-time and human:

1. **Account.** Sign up at <https://central.sonatype.com> (the Central Portal; the legacy OSSRH/JIRA flow is
   retired and takes no new namespaces).
2. **Namespace verification — decide the group first.** The published group is `com.fundamental`
   (`android/build.gradle.kts`, `subprojects { group = … }`). Central verifies a `com.*` namespace with a DNS
   TXT record on the matching domain, so `com.fundamental` means proving ownership of **fundamental.com**. If
   that domain isn't yours, choose a verifiable group *before* the first upload — Central coordinates are
   permanent: `com.fundamental-engine` (TXT record on fundamental-engine.com, the project's homepage) or
   `io.github.zachshallbetter` (verified by creating a temporary public repo named by the Portal). It is a
   one-line change, but the GitHub Packages consumers (Ascent) move to the new coordinates with it, so make it
   a deliberate, changelogged step.
3. **GPG key.** `gpg --full-generate-key` (RSA 4096 or ed25519, an expiry is fine), publish the public key
   where Central looks (`gpg --keyserver keyserver.ubuntu.com --send-keys <id>`), then export the private
   key: `gpg --armor --export-secret-keys <id>`.
4. **Repository secrets** (Settings → Secrets and variables → Actions). None of these exist yet; none is
   ever committed:

   | secret | what |
   |---|---|
   | `SIGNING_KEY` | the ASCII-armored private key from step 3 — the whole block, newlines included |
   | `SIGNING_PASSWORD` | its passphrase (empty if the key has none) |
   | `SIGNING_KEY_ID` | optional — the key id, only if the key has several signing subkeys |
   | `MAVEN_CENTRAL_USERNAME` | a Portal **user token** username (Portal → account → *Generate User Token*) — never the login |
   | `MAVEN_CENTRAL_PASSWORD` | the matching user-token password |

5. **Rehearse.** Actions → `maven-central` → *Run workflow* with the tag; `dry_run` is on by default. It runs
   `publishToMavenLocal` for both modules, then `centralBundle`, prints the exact file manifest that would be
   uploaded, and attaches the bundle zip to the run. Locally: `cd android && ./gradlew centralBundle
   -PreleaseVersion=X.Y.Z` (unsigned without `SIGNING_KEY`, which is fine for a rehearsal).
6. **Upload.** Re-dispatch with `dry_run` unchecked. With the default `USER_MANAGED` publishing type the
   deployment is validated and then **waits for you to press Publish in the Portal**; `AUTOMATIC` publishes
   as soon as validation passes. `./gradlew centralStatus -PcentralDeploymentId=<id>` polls a deployment.
7. **Cut over.** Once a release resolves from plain `mavenCentral()`, move Ascent and the Android README off
   `gpr.key`, and decide whether the GitHub Packages job keeps running alongside (it can — both targets
   publish the same `MavenPublication`, so they can never carry different bytes).

Nothing in this path runs on a tag push. Wiring `centralUpload` into `android.yml`'s release job is a policy
change per [RELEASING.md](RELEASING.md) and rides its own PR.

## The Rust plane (crates.io)

`rust/crates/fundamental-core` publishes to crates.io as `fundamental-core`, at the same version as the
npm packages, through the **dispatch-only, dry-run-by-default**
[`.github/workflows/crates-io.yml`](.github/workflows/crates-io.yml) — never from a tag push and never
from a laptop. It needs a maintainer-created `CARGO_REGISTRY_TOKEN` repository secret. The policy,
the dispatch commands, and the immutability rule (yank, never re-upload) are in
[`RELEASING.md`](RELEASING.md) § "The Rust plane (crates.io)".

## Versioning

All seven published packages are versioned together (currently `0.10.1`). Bump them as one:

```sh
pnpm --filter "./packages/*" exec npm version <patch|minor|major> --no-git-tag-version
```

Per the `0.x` rules in [API stability](docs/canonical/api-stability.md), a breaking change to a
protected symbol is a **minor** bump (`0.2 → 0.3`); additive and fix-only changes are patches. The private
`site` / `starter` apps are versioned independently and not published.
