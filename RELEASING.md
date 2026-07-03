# Releasing

How versions are cut and published. The mechanical detail lives in
[`PUBLISHING.md`](PUBLISHING.md); this document is the policy around it.

## Versioning policy

The seven published packages — `@fundamental-engine/core`, `@fundamental-engine/dom`,
`@fundamental-engine/elements`, `@fundamental-engine/react`, `@fundamental-engine/vanilla`,
`@fundamental-engine/three`, `@fundamental-engine/create` (the scaffolding CLI) — are versioned
**together**. (The umbrella meta-packages `@fundamental-engine/kit` / `fundamental-engine` were retired in
0.7.0 and are no longer published — they are kept `private` in the workspace. `@fundamental-engine/three`
declares `three` as a peer dependency.) They follow [Semantic Versioning](https://semver.org):

- **patch** (`0.2.x`) — bug fixes, internal changes, **and additive backward-compatible features**
  (a new force, a new `FieldOption`, a new `FieldHandle` method). Pre-1.0, additions land in a patch —
  this matches the canonical freeze contract
  ([API stability](docs/canonical/api-stability.md): the stable surface is additive-only
  within a 0.MINOR line).
- **minor** (`0.x.0`) — **the breaking position pre-1.0**: renaming, removing, or changing the
  signature/shape of a frozen symbol bumps `0.MINOR`, called out in the CHANGELOG under a
  **Breaking** heading with a migration note. Consumers should pin to `~0.MINOR`.
- **major** (`1.0.0`) — the stability promise itself; from 1.0 on, standard SemVer applies.

The engine's public surface is: the `@fundamental-engine/core` exports (`createField`, `FieldOptions`,
`FieldHandle`, the catalog, the conformance API), the `data-*` attribute vocabulary, the `<field-root>`
element attributes/methods, the `@fundamental-engine/vanilla` `FieldField` class and `mountField`, and the React
adapter's props. The internal integrator, render code, and the site are not part of the public
contract. It is frozen for `0.x` and gated by `pnpm check:api` — see
[API stability](docs/canonical/api-stability.md).

> The packages are published to npm under the `@fundamental-engine` scope, **with provenance** (a signed
> Sigstore/SLSA attestation tying each tarball to this repo and the CI build). Each release is cut as a
> **git tag** (`vX.Y.Z`); pushing the tag is what triggers the publish. Between tags, changes accumulate
> under `## [Unreleased]` in the [CHANGELOG](CHANGELOG.md).

## Cutting a release

1. **Green `main`.** CI (typecheck · test · build · checks) must be passing.
2. **Update the CHANGELOG.** Add a versioned, dated heading (`## [x.y.z] — YYYY-MM-DD`) following
   [Keep a Changelog](https://keepachangelog.com).
3. **Bump all seven packages together** (keep them at the same version):
   ```sh
   pnpm --filter "@fundamental-engine/*" exec npm version <patch|minor|major> --no-git-tag-version
   ```
   The private apps (`site`, `starter`) are versioned independently and are not published.
4. **Bump `FIELD_VERSION` on all three planes** — the constant is hand-maintained per plane, and a
   lockstep test on each fails CI if it drifts from `packages/core/package.json`:
   - JS: `packages/core/src/version.ts` (guard: `version.test.ts`)
   - Swift: `swift/Sources/FundamentalCore/Engine/FieldSnapshot.swift` (guard: `VersionLockstepTests`)
   - Kotlin: `android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldSnapshot.kt`
     (guard: `VersionLockstepTests`)
5. **Commit, tag, push the tag** — pushing the tag triggers the release workflow:
   ```sh
   git commit -am "release: vX.Y.Z"
   git tag -a vX.Y.Z -m "Release X.Y.Z"   # annotated; this repo requires it
   git push && git push origin vX.Y.Z
   ```
6. **CI publishes.** `.github/workflows/release.yml` runs the full gate, then publishes every
   `@fundamental-engine/*` package with provenance. Watch it: `gh run watch` (or the Actions tab). It re-reads the
   `NPM_TOKEN` secret each run, so a failed publish can be retried with `gh run rerun <id> --failed`.
7. **Create the GitHub release** for the tag, pasting the CHANGELOG section.
8. **Smoke-test** a clean install (`npm i @fundamental-engine/vanilla` in a fresh directory) and confirm the scoped
   packages resolve the core dependency.

## What CI does

- **`ci.yml`** — typecheck · test · build · checks on every push and PR to `main`. Never publishes.
- **`release.yml`** — on a `v*` tag (or manual dispatch): runs the gate, then publishes all
  `@fundamental-engine/*` packages **with provenance**. Requirements (all in place): the GitHub repo is **public**
  (npm rejects provenance for private repos) and an `NPM_TOKEN` secret holds a granular npm token with
  write to `@fundamental-engine` and **2FA-bypass** enabled (CI cannot answer an interactive OTP).
- **`pr-checks.yml`** — PR hygiene: a PR that changes `packages/` must add a CHANGELOG entry
  (the diff is checked, not the PR body), and every relative doc link must resolve
  (`pnpm check:links`). Its `conclusion-pr` job is a required check on `main`.
- **`api-surface.yml`** — on PRs touching the packages, posts the frozen-surface delta
  (base vs. head of `scripts/api-surface.data.mjs`) as a PR comment. Visibility only; the
  blocker is `check:api` in `ci.yml`.

Every workflow ends in a `conclusion` job that passes only if **every** dependency job
succeeded — a skipped job can never satisfy a required check. Branch protection on `main`
requires `conclusion` and `conclusion-pr`, with no admin bypass.

## Release safety — the human rules

CI makes a bad publish structurally hard; these are the rules for the parts only a human
touches. The catastrophic-release taxonomy behind them (API breakage, broken/partial/
no-provenance publish, version desync, red-main tag, credential leak) maps one-to-one to
the gates above.

- **Never push a tag on a non-green `main`.** Confirmed green in the Actions tab on the
  exact merge commit — not "probably green". The release gate re-runs everything anyway,
  but a red tag burns the version number.
- **Never publish from a laptop**, except the documented manual fallback in
  [PUBLISHING.md](PUBLISHING.md) (no provenance, OTP per package). If the fallback is ever
  used, log it as an exception in the CHANGELOG entry for that release — "published
  without provenance" is a recorded fact, not a silent degradation.
- **Never bump one package alone.** Always
  `pnpm --filter "@fundamental-engine/*" exec npm version <bump> --no-git-tag-version` — the release
  gate fails the tag if any of the seven is out of step.
- **Never widen a failing gate to make it pass.** If `check:api` fails, the public
  contract changed: fix the change or cut a deliberate 0.MINOR with a migration note —
  never edit the baseline to silence it. If e2e fails on one browser, fix the race; don't
  skip the project.
- **Partial publish recovery:** the publish step now **auto-retries up to 3×** in-step to absorb the
  transient Sigstore provenance tlog 409 (`an equivalent entry already exists in the transparency log`)
  that intermittently aborts the run after some packages publish (it bit v0.9.2 after `core`). If it
  still fails after the retries, `gh run rerun <run-id> --failed`. The publish is idempotent per-package
  (already-published versions are skipped), so retries only re-attempt the packages that didn't land. Do
  **not** delete or re-push the tag, and do not re-run the whole workflow from scratch.
- **Token rotation:** create the new granular token (`@fundamental-engine` write, 2FA-bypass) and
  update the `NPM_TOKEN` secret **before** revoking the old one — a window with no valid
  token makes the next release fail at auth. Verify with a `dry_run` dispatch of
  `release.yml`.
- **Changing these gates is a policy change**, not a PR judgment call — gate edits ride
  their own PR that says so explicitly.
