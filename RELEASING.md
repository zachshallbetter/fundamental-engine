# Releasing

How versions are cut and published. The mechanical publish steps live in
[`PUBLISHING.md`](PUBLISHING.md); this document is the policy around them.

## Versioning policy

The four published packages — `field-ui`, `@field-ui/vanilla`, `@field-ui/elements`,
`@field-ui/react` — are versioned **together** and follow [Semantic Versioning](https://semver.org):

- **patch** (`0.1.x`) — bug fixes, internal changes, no API change.
- **minor** (`0.x.0`) — additive, backward-compatible features (a new force, a new
  `FieldOption`, a new `FieldHandle` method).
- **major** — a breaking change to the public API. **Pre-1.0**, breaking changes may land
  in a **minor** bump, but the CHANGELOG must call them out under a **Breaking** heading.

The engine's public surface is: the `field-ui` exports (`createField`, `FieldOptions`,
`FieldHandle`, the catalog, the conformance API), the `data-*` attribute vocabulary, the
`<field-root>` element attributes/methods, the `@field-ui/vanilla` `FieldField` class and
`mountField`, and the React adapter's props. The internal integrator, render code, and the
site are not part of the public contract.

> **The packages are published to npm under the `@field-ui` scope** (`@field-ui/core`,
> `@field-ui/platform`, `@field-ui/elements`, `@field-ui/react`, `@field-ui/vanilla`).
> Each release is also cut as a **git tag** (e.g. `v0.2.1`) to checkpoint the engine.
> Between tags, changes accumulate under `## [Unreleased]` in the [CHANGELOG](CHANGELOG.md).

## Cutting a release

1. **Green `main`.** CI (typecheck · test · build) must be passing.
2. **Update the CHANGELOG.** Move `## [Unreleased]` to a versioned, dated heading
   (`## [x.y.z] — YYYY-MM-DD`) following [Keep a Changelog](https://keepachangelog.com).
3. **Bump the three packages together:**
   ```sh
   pnpm --filter field-ui --filter @field-ui/vanilla --filter @field-ui/elements --filter @field-ui/react \
     exec npm version <patch|minor|major> --no-git-tag-version
   ```
   Keep them at the same version. (The site app is versioned independently and is not
   published.)
4. **Commit + tag:**
   ```sh
   git commit -am "chore(release): vX.Y.Z"
   git tag vX.Y.Z
   git push --follow-tags
   ```
5. **Publish** per [`PUBLISHING.md`](PUBLISHING.md) in **dependency order** — `field-ui`
   (core) first, then `@field-ui/vanilla`, then `@field-ui/elements` (which depends on
   vanilla) and `@field-ui/react`. `pnpm` rewrites `workspace:*` to the real version
   automatically, so each dependency must already be published when its dependents go out.
6. **Create the GitHub release** for the tag, pasting the CHANGELOG section.
7. **Smoke-test** a clean install (`npm i @field-ui/core` in a fresh directory) and confirm the
   scoped adapters resolve the core dependency.

## What CI does (and does not) do

CI runs typecheck · test · build on every push and PR. It **does not** publish —
publishing is a deliberate, human-run step (it changes public state and needs npm auth),
so it is never automated here.
