# Release runbook

Policy lives in [`docs/meta/releasing.md`](../../docs/meta/releasing.md) (patch vs minor, cadence) and
mechanics in [`docs/meta/publishing.md`](../../docs/meta/publishing.md). This is the operator's checklist,
as executed for **0.11.1** on 2026-10-14 (#1247, tag `v0.11.1` on merge commit `adb7b04c`).

**Only when the maintainer explicitly asks for a release.** An npm publish cannot be cleanly undone
(unpublish is time-limited and burns the version number).

## Pre-flight (verify reality, not memory)

- `main` is green: `gh run list --branch main --limit 6` — `CI` success on the head you'll release.
- What's in `[Unreleased]` is what you think, and it's coherent enough to ship.
- npm's current state: `npm view @fundamental-engine/core dist-tags`.
- The previous release PR is the template for the file set: `gh pr view <prev> --json files`.
- Patch or minor? Patch unless a `check:api`-protected symbol changes or the cadence policy calls for a
  milestone minor.

## The release PR (`main` is protected — no direct commits)

In a worktree on `origin/main`, branch `release/X.Y.Z`:

1. **Packages**: `pnpm --filter "./packages/*" exec npm version patch --no-git-tag-version`
   (path filter, never the `@fundamental-engine/*` name glob — that also bumps the private apps).
   `npm version` rewrites `—` escapes in `description` fields as literal em dashes; restore the
   escapes so the diff is version lines only.
2. **`FIELD_VERSION` on every plane** (each has a lockstep test that reds its CI job if missed):
   - `packages/core/src/version.ts`
   - `swift/Sources/FundamentalCore/Engine/FieldSnapshot.swift`
   - `android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldSnapshot.kt`
   - `rust/crates/fundamental-core/src/version.rs`, `[workspace.package].version` in `rust/Cargo.toml`,
     the `fundamental-core` dependency pin in `rust/crates/fundamental-platform/Cargo.toml`, then
     `cd rust && cargo build` to refresh `Cargo.lock` (CI runs `--locked`).
3. **Citation metadata**: `CITATION.cff` (`version`, `date-released` = the local release date),
   `.zenodo.json` (version, description, `tree/vX.Y.Z` identifier), the README citation block and BibTeX.
4. **CHANGELOG**: insert `## [X.Y.Z] — YYYY-MM-DD` under an emptied `## [Unreleased]`, with a one-line
   headline; add `docs/release-notes/X.Y.Z.md` (why this version number, what to upgrade for).
5. **Scaffolder templates** move only on a minor/major: `packages/create/templates/*/package.json` to
   `^X.Y.0` (`packages/create/src/cli.test.ts` enforces it).
6. Gates: the full local gate, `cargo test --locked`, and **`pnpm check:consumer`** against the new
   tarballs. Open the PR; wait for every plane's CI (Swift macOS/iOS/Linux, Android, Rust), not only the
   two required checks.

## Tag and publish

```sh
gh pr merge <release-pr> --merge          # only with the maintainer's go-ahead
git fetch origin
git tag -a vX.Y.Z <merge-commit-sha> -m "Release X.Y.Z"   # annotated, on the merge commit, verified == origin/main
git push origin vX.Y.Z
```

Pushing the tag runs `release.yml`: full gate + tag↔version match → **publish via npm Trusted
Publishing (OIDC)** with provenance → GitHub release → post-publish verification. The same tag drives the
Maven publish (`android.yml`) and is the SwiftPM version. Watch it: `gh run watch <id>`.

**`post-publish verification` flakes on npm propagation.** It installs from the registry seconds after
publishing and can fail with `ETARGET No matching version found for @fundamental-engine/dom@X.Y.Z` (or a
signatures check) even though every package published. Confirm with `npm view @fundamental-engine/<pkg>@X.Y.Z
version` for all seven, then `gh run rerun <id> --failed` — this re-runs only verification. **Never
republish.**

## After publishing — verify like a user

```sh
cd "$(mktemp -d)"
npm create --yes @fundamental-engine@X.Y.Z app -- --template web-component
cd app && npm install && npm run build
npm ls @fundamental-engine/core @fundamental-engine/elements   # resolves X.Y.Z
grep -l '"field-cell"' dist/assets/*.js                        # elements still registered after bundling
```

Consumers that pin an exact version (zachshallbetter.com pins `0.11.1`) only see a release after their
own version bump — see [sites.md](sites.md).

## Tags are a publish trigger

`release.yml` runs on any `v*` tag push. A bulk force-push that re-pushes old tags re-triggers it
(2026-10-14: `v0.8.1`, `v0.5.1` failed at the gate; `v0.2.3` ran green without publishing). If tags are
ever re-pushed, list the triggered runs (`gh run list --workflow release.yml`) and make sure none reaches
`publish (provenance)` for a version that shouldn't ship.
