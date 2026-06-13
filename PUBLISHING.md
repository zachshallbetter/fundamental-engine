# Publishing

The seven `@fundamental-engine/*` packages publish to npm **with provenance** via CI. This document is the
mechanics; the policy (versioning, when to cut) is in [`RELEASING.md`](RELEASING.md).

> The public surface is frozen for `0.x` — see
> [API stability](docs/canonical/field-ui-api-stability.md). `pnpm check:api` (run in CI and the
> release workflow) fails if a frozen symbol changes, so a release can't break the contract by accident.

## The packages

| npm name | role |
|---|---|
| `@fundamental-engine/core` | the engine (no workspace deps) |
| `@fundamental-engine/platform` | depends on core |
| `@fundamental-engine/vanilla` | depends on core + platform |
| `@fundamental-engine/react` | depends on core + platform |
| `@fundamental-engine/elements` | depends on core + platform + vanilla |
| `@fundamental-engine/kit` | umbrella meta-package — depends on all five |
| `fundamental-engine` | thin alias — depends on kit |

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
`pnpm --filter "@fundamental-engine/*" publish --access public --no-git-checks --provenance`. A failed publish can
be retried without re-tagging: `gh run rerun <run-id> --failed`.

### Prerequisites (all currently satisfied)

- The GitHub repo is **public** — npm refuses provenance for private repos (`E422 … visibility:
  "private"`).
- The `NPM_TOKEN` repo secret is a **granular** npm token with read+write to `@field-ui` and
  **"Bypass two-factor authentication" enabled**. A classic/publish token fails in CI with `EOTP`
  (the account is 2FA `auth-and-writes`, and CI can't answer an OTP prompt).
- The workflow has `permissions: id-token: write` (for the provenance attestation).

## Manual fallback (no provenance)

Only if CI is unavailable. This publishes **without** provenance and needs an OTP each run:

```sh
pnpm -r build && pnpm test && pnpm check:dist && pnpm check:api   # gate
pnpm --filter "@fundamental-engine/*" publish --access public --no-git-checks --otp=<code>
```

## Versioning

All seven packages are versioned together (currently `0.2.2`). Bump them as one:

```sh
pnpm --filter "@fundamental-engine/*" exec npm version <patch|minor|major> --no-git-tag-version
```

Per the `0.x` rules in [API stability](docs/canonical/field-ui-api-stability.md), a breaking change to a
frozen symbol is a **minor** bump (`0.2 → 0.3`); additive and fix-only changes are patches. The private
`site` / `starter` apps are versioned independently and not published.
