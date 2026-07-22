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
`pnpm --filter "@fundamental-engine/*" publish --access public --no-git-checks --provenance`. A failed publish can
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
pnpm --filter "@fundamental-engine/*" publish --access public --no-git-checks --otp=<code>
```

## Versioning

All seven published packages are versioned together (currently `0.10.0`). Bump them as one:

```sh
pnpm --filter "@fundamental-engine/*" exec npm version <patch|minor|major> --no-git-tag-version
```

Per the `0.x` rules in [API stability](docs/canonical/api-stability.md), a breaking change to a
protected symbol is a **minor** bump (`0.2 → 0.3`); additive and fix-only changes are patches. The private
`site` / `starter` apps are versioned independently and not published.
