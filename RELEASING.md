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

- **patch** (`0.9.x`) — bug fixes, internal changes, and **additive** features (a new force,
  `FieldOption`, or `FieldHandle` method). Pre-1.0 a patch may also retire an **already-deprecated**
  alias or change **unprotected** surface — 0.9.3 dropped the retired alias packages in a
  patch. What a patch never does is remove a `check:api`-protected symbol.
- **minor** (`0.x.0`) — removing or renaming a **`check:api`-protected symbol**, or changing its
  signature, bumps `0.MINOR`, under a **Breaking** heading with a
  migration note.
- **major** (`1.0.0`) — the stability promise itself; from 1.0 on, standard SemVer applies.

**Pre-1.0, pin an exact version.** The stable subset is protected, but the wider surface is still
moving between releases; `~0.MINOR` is not a safe range yet. Read the CHANGELOG before upgrading.

The engine's public surface is: the `@fundamental-engine/core` exports (`createField`, `FieldOptions`,
`FieldHandle`, the catalog, the conformance API), the `data-*` attribute vocabulary, the `<field-root>`
element attributes/methods, the `@fundamental-engine/vanilla` `FieldField` class and `mountField`, and the React
adapter's props. The internal integrator, render code, and the site are not part of the public
contract. A listed subset is **protected from silent removal** by `pnpm check:api` — that is a guard against
accidental breakage, not a freeze; the surface evolves pre-1.0 and additions never fail the check. See
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
   pnpm --filter "./packages/*" exec npm version <patch|minor|major> --no-git-tag-version
   ```

   > **Scope the bump to `./packages/*`, never `@fundamental-engine/*`.** The name glob also matches the
   > private apps (`apps/site`, `apps/starter`, `apps/observatory`) — same npm scope, independent versions.
   > `exec npm version` ignores the `private` flag, so the glob silently bumps them to the release version.
   > (`pnpm publish` already skips private packages, so only the version bump was ever affected.)
   The path filter targets exactly the seven publishable packages — no private app is bumped, so
   there is nothing to revert. Confirm the set with
   `pnpm --filter "./packages/*" exec node -e "const p=require('./package.json');console.log(p.name,p.private?'private':'PUBLISHED')"`.
4. **Bump `FIELD_VERSION` on all four planes** — the constant is hand-maintained per plane, and a
   lockstep test on each fails CI if it drifts from `packages/core/package.json`:
   - JS: `packages/core/src/version.ts` (guard: `version.test.ts`)
   - Swift: `swift/Sources/FundamentalCore/Engine/FieldSnapshot.swift` (guard: `VersionLockstepTests`)
   - Kotlin: `android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldSnapshot.kt`
     (guard: `VersionLockstepTests`)
   - Rust: `rust/crates/fundamental-core/src/version.rs` **and** `[workspace.package].version` in
     `rust/Cargo.toml`, then `cargo build` in `rust/` to refresh `Cargo.lock` (guard:
     `tests/version_lockstep.rs`; `rust.yml` runs `--locked`, so a stale lock fails CI)
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
- **`api-surface.yml`** — on PRs touching the packages, posts the protected-surface delta
  (base vs. head of `scripts/api-surface.data.mjs`) as a PR comment. Visibility only; the
  blocker is `check:api` in `ci.yml`.
- **`rust.yml`** — build + test the Rust plane (`rust/`) on changes under it or to the shared
  conformance golden. Not a required check on `main`. Never publishes.
- **`crates-io.yml`** — **dispatch-only, dry-run by default**: the Rust plane's publish path to
  crates.io. Never runs on a push, tag, or PR. See "The Rust plane (crates.io)" below.
- **`perf-hardware.yml`** — the RC-7 performance gate, on the **self-hosted `titan-gpu` runner**
  (a GTX TITAN X box; hardware WebGL through ANGLE-over-EGL in headless Chrome). On PRs and pushes
  that touch the engine, the site, or the perf scripts it runs the Node compute bench and the
  `/perf-bench` GPU sweep at DPR 1 and 2 plus 20 s on three real pages, then
  `scripts/perf/check-budgets.mjs` fails the job if any number breaches
  `docs/planning/perf-budgets.json`. The budgets are *generated* from the measured
  `docs/planning/fundamental-perf-fact-sheet.md` (`scripts/perf/write-fact-sheet.mjs`) — to move one,
  re-measure (`workflow_dispatch`, download the `perf-measurements-*` artifact) and commit the
  regenerated pair; never edit the budgets by hand. Its `conclusion-perf` job is **not yet a required
  check** — promote it once a few runs on the runner have shown it stable; a runner outage must not
  block unrelated merges.

Every workflow ends in a `conclusion` job that passes only if **every** dependency job
succeeded — a skipped job can never satisfy a required check. Branch protection on `main`
requires `conclusion` and `conclusion-pr`, with no admin bypass.

## The Rust plane (crates.io)

The Rust plane (`rust/`) publishes to [crates.io](https://crates.io) as **`fundamental-core`** — the
crates.io spelling of `@fundamental-engine/core` (crates.io has no scopes, so the crate name carries
the layer; later layers follow as `fundamental-platform`, …). The decision and its reasoning are in
[`docs/planning/rust-publishing-decision.md`](docs/planning/rust-publishing-decision.md).

- **Lockstep, no separate version line.** Crate `x.y.z` *is* engine `x.y.z`: `[workspace.package].version`
  in `rust/Cargo.toml` = the Rust `FIELD_VERSION` (`rust/crates/fundamental-core/src/version.rs`) =
  `packages/core/package.json`. `tests/version_lockstep.rs` fails the suite if they drift; step 4 above
  bumps all four planes together. The crate ships under the fleet's `vX.Y.Z` tag — there is **no Rust
  tag**.
- **Dispatch-only, dry-run by default.** `.github/workflows/crates-io.yml` never runs on a push, tag,
  or PR. After the npm / Swift / Kotlin release for a tag is out, the maintainer rehearses, then
  publishes:
  ```sh
  gh workflow run crates-io.yml -f tag=vX.Y.Z                    # rehearsal: gate + package + publish --dry-run, no upload
  gh workflow run crates-io.yml -f tag=vX.Y.Z -f dry_run=false   # the real publish — only after a green rehearsal
  ```
  The gate is `rust.yml`'s build + test, then tag == crate == `FIELD_VERSION` == `packages/core`,
  `cargo package --list`, `cargo publish --dry-run`. The `publish` job runs in the `crates-io` GitHub
  environment (attach a required reviewer there if wanted).
- **Requirements (maintainer-created, never committed):** a repository secret **`CARGO_REGISTRY_TOKEN`**
  — a crates.io API token on the maintainer's own crates.io account, scoped `publish-new` +
  `publish-update`, crate pattern `fundamental-*`. The first publish of a name claims it for that
  account. Once the crate exists, switch to crates.io **Trusted Publishing** (GitHub OIDC, no stored
  secret — the crates.io analogue of npm provenance) as a follow-up policy PR.
- **crates.io versions are immutable.** A published version can be `cargo yank`ed, never replaced or
  re-uploaded — a bad Rust release is a yank plus the next fleet patch, and a publish re-run for a
  version already on the registry fails by design. Never re-tag.
- **Never `cargo publish` from a laptop.** Same rule as npm; there is no documented Rust fallback.
- **Adding `crates-io.yml` was a policy change** under the rule below, and rode its own PR (#1047)
  that said so. Promoting it to a `v*` trigger later is another one.

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
  `pnpm --filter "./packages/*" exec npm version <bump> --no-git-tag-version` — the release
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
