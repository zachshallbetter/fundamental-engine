# Releasing

How versions are cut and published. The mechanical detail lives in
[`PUBLISHING.md`](PUBLISHING.md); this document is the policy around it.

## Versioning policy

The seven published packages — `@field-ui/core`, `@field-ui/platform`, `@field-ui/elements`,
`@field-ui/react`, `@field-ui/vanilla`, and the meta-packages `@field-ui/kit` / `@field-ui/field-ui` —
are versioned **together** and follow [Semantic Versioning](https://semver.org):

- **patch** (`0.2.x`) — bug fixes, internal changes, no API change.
- **minor** (`0.x.0`) — additive, backward-compatible features (a new force, a new `FieldOption`, a new
  `FieldHandle` method).
- **major** — a breaking change to the public API. **Pre-1.0**, breaking changes may land in a **minor**
  bump, but the CHANGELOG must call them out under a **Breaking** heading.

The engine's public surface is: the `@field-ui/core` exports (`createField`, `FieldOptions`,
`FieldHandle`, the catalog, the conformance API), the `data-*` attribute vocabulary, the `<field-root>`
element attributes/methods, the `@field-ui/vanilla` `FieldField` class and `mountField`, and the React
adapter's props. The internal integrator, render code, and the site are not part of the public
contract. It is frozen for `0.x` and gated by `pnpm check:api` — see
[API stability](docs/canonical/field-ui-api-stability.md).

> The packages are published to npm under the `@field-ui` scope, **with provenance** (a signed
> Sigstore/SLSA attestation tying each tarball to this repo and the CI build). Each release is cut as a
> **git tag** (`vX.Y.Z`); pushing the tag is what triggers the publish. Between tags, changes accumulate
> under `## [Unreleased]` in the [CHANGELOG](CHANGELOG.md).

## Cutting a release

1. **Green `main`.** CI (typecheck · test · build · checks) must be passing.
2. **Update the CHANGELOG.** Add a versioned, dated heading (`## [x.y.z] — YYYY-MM-DD`) following
   [Keep a Changelog](https://keepachangelog.com).
3. **Bump all seven packages together** (keep them at the same version):
   ```sh
   pnpm --filter "@field-ui/*" exec npm version <patch|minor|major> --no-git-tag-version
   ```
   The private apps (`site`, `starter`) are versioned independently and are not published.
4. **Commit, tag, push the tag** — pushing the tag triggers the release workflow:
   ```sh
   git commit -am "release: vX.Y.Z"
   git tag -a vX.Y.Z -m "Release X.Y.Z"   # annotated; this repo requires it
   git push && git push origin vX.Y.Z
   ```
5. **CI publishes.** `.github/workflows/release.yml` runs the full gate, then publishes every
   `@field-ui/*` package with provenance. Watch it: `gh run watch` (or the Actions tab). It re-reads the
   `NPM_TOKEN` secret each run, so a failed publish can be retried with `gh run rerun <id> --failed`.
6. **Create the GitHub release** for the tag, pasting the CHANGELOG section.
7. **Smoke-test** a clean install (`npm i @field-ui/kit` in a fresh directory) and confirm the scoped
   packages resolve the core dependency.

## What CI does

- **`ci.yml`** — typecheck · test · build · checks on every push and PR to `main`. Never publishes.
- **`release.yml`** — on a `v*` tag (or manual dispatch): runs the gate, then publishes all
  `@field-ui/*` packages **with provenance**. Requirements (all in place): the GitHub repo is **public**
  (npm rejects provenance for private repos) and an `NPM_TOKEN` secret holds a granular npm token with
  write to `@field-ui` and **2FA-bypass** enabled (CI cannot answer an interactive OTP).
