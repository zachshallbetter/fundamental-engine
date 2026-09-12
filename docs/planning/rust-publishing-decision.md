# Rust plane — the crates.io publishing decision (#1047)

> **Status: decided and prepared — NOTHING published.** This records the naming, versioning, and
> release-path decisions for the Rust plane (`rust/`), and what was verified. The publish itself is a
> maintainer act: a hand-dispatched run of `.github/workflows/crates-io.yml` with `dry_run=false`, after
> the npm / Swift / Kotlin release for the same tag is out. The human rules live in
> [`../../RELEASING.md`](../../RELEASING.md) § "The Rust plane (crates.io)". Parent epic: #1036.

| Question | Decision |
|---|---|
| Crate name | **`fundamental-core`** — the crates.io spelling of `@fundamental-engine/core`; later layers follow (`fundamental-platform`, …) |
| Version | **Lockstep** with `FIELD_VERSION` — crate `x.y.z` *is* engine `x.y.z`; no independent Rust version line |
| Tag | The fleet's `vX.Y.Z` tag; **no separate Rust tag** |
| Trigger | `workflow_dispatch` only, **dry-run by default**; never on tag push while the plane is experimental |
| Credentials | `CARGO_REGISTRY_TOKEN` repository secret (maintainer-created); crates.io Trusted Publishing as the follow-up once the crate exists |

## 1. Naming — `fundamental-core`

The options weighed in #1047:

| Option | Verdict |
|---|---|
| `fundamental-core` / `fundamental-platform` / … | **Chosen.** crates.io has no scopes, so the crate name has to carry the layer. `fundamental-<layer>` is exactly how the other planes already spell it: npm `@fundamental-engine/<layer>`, Swift `FundamentalCore`, Kotlin `android/fundamental-core`. The Rust path is `fundamental_core::` either way. |
| `fundamental-engine-core` | Rejected. Longer, and the `-engine-` infix buys no disambiguation on the registry — nothing named `fundamental-*` exists there today (see availability). It would also be the only plane whose module name differs from the layer name. |
| `fundamental` (umbrella) | Rejected. The npm umbrellas (`@fundamental-engine/kit`, `fundamental-engine`) were retired in 0.7.0; there is no umbrella to mirror, and a bare generic word invites confusion with the unrelated `fundamentals` crate. |

**Availability (read-only check, 2026-09-11).** A `GET https://crates.io/api/v1/crates/<name>` for
`fundamental-core`, `fundamental_core` (crates.io treats `-` and `_` as the same name),
`fundamental-platform`, `fundamental-engine`, and `fundamental` each returned `404` with
`crate … does not exist`; a control request for `serde` returned `200`. A search for `fundamental`
lists only unrelated crates (`fundamentals`, `paft-fundamentals`, `cetkaik_fundamental`). **Nothing was
reserved** — crates.io has no reservation mechanism short of publishing, and publishing an empty
placeholder is name-squatting the registry's policy discourages. The first publish claims the name for
the token's account, so it should follow this decision promptly rather than sit.

**Which tag can be the first one: not `v0.10.1`.** The Rust plane landed in #1108 on 2026-09-11, seven
weeks after `v0.10.1` was cut (2026-07-21) — `git ls-tree -d v0.10.1 rust` is empty. This workflow checks
out `inputs.tag` and builds inside `rust/`, so a dispatch against any existing tag dies before the lockstep
check on a missing directory. **The first publishable version is the next fleet tag**, and until that tag
exists the workflow cannot be rehearsed end to end; `cargo package`/`publish --dry-run` from a working tree
(`cd rust && cargo publish -p fundamental-core --dry-run`) is the rehearsal available before then.

## 2. Versioning — lockstep with `FIELD_VERSION`

**Independent Rust versioning was rejected.** The crate stamps `FIELD_VERSION` onto every capture the
same way the Swift/Kotlin `FieldSnapshot` planes do, it is held to the *shared* cross-plane golden, and
the fleet's release story since 0.10.0 is "one tag releases every plane at one number". A Rust crate at
`0.3.0` next to an engine at `0.10.1` would break that story for no gain. The cost is symmetric with
Kotlin's: a Rust-only fix is a fleet-wide patch bump (0.10.1 was exactly that, Kotlin-only). Pre-1.0
the Rust plane is experimental at the fleet's number — the crate README says to pin an exact version.

The mechanism (all in this PR, all verified by `cargo test`):

- `rust/Cargo.toml` `[workspace.package].version` is the release version; the crate uses
  `version.workspace = true`. `Cargo.lock` carries it too — regenerate with `cargo build` when bumping
  (`--locked` in `rust.yml` / `crates-io.yml` fails on a stale lock).
- `rust/crates/fundamental-core/src/version.rs` — `pub const FIELD_VERSION`, the Rust mirror of the JS /
  Swift / Kotlin constants, re-exported at the crate root.
- `rust/crates/fundamental-core/tests/version_lockstep.rs` — the drift guard. Asserts
  `FIELD_VERSION == CARGO_PKG_VERSION` always, and `== packages/core/package.json` when run from the
  monorepo (skipped, with a note, on the published crate source where that file does not exist).
- `RELEASING.md` step 4 now lists **four** planes to bump; `crates-io.yml` re-checks tag == crate ==
  `FIELD_VERSION` == `packages/core` before it will package anything.

## 3. Release path — `crates-io.yml`, dispatch-only, dry-run by default

`.github/workflows/crates-io.yml` mirrors `release.yml`'s shape (gate → publish → conclusion) with two
deliberate differences:

1. **It is not tag-triggered.** While the plane is experimental, whether the Rust crate ships with a
   given release is a per-release maintainer call, and adding a publish surface is a policy change
   under RELEASING.md's own rule — so the workflow is `workflow_dispatch` only, and the PR that added it
   says so. Promoting it to a `v*` trigger (i.e. folding it into `release.yml`) is a later, explicit
   policy PR, sensible once the plane is on the parity page.
2. **`dry_run` defaults to `true`.** A bare dispatch rehearses everything — build, test, the lockstep
   check, `cargo package --list`, `cargo publish --dry-run` — and uploads nothing. Only
   `-f dry_run=false` reaches the `publish` job, which runs in a `crates-io` GitHub environment so a
   required reviewer can be attached to it.

Provenance: npm's Sigstore provenance has no exact crates.io twin, but crates.io **Trusted Publishing**
(GitHub OIDC → short-lived token, no stored secret) is the analogue, and the trusted-publisher record
on crates.io ties the crate to this repo + this workflow file. It cannot be configured until the crate
exists, so the first publish uses `CARGO_REGISTRY_TOKEN`; switching afterwards is a follow-up.

**Manifest metadata** (`rust/crates/fundamental-core/Cargo.toml`): description, `license = "MIT"`
(the repo `LICENSE`), `repository`, `homepage`, `documentation` (docs.rs), five keywords, three
categories (`simulation`, `science`, `algorithms`), a crate-local `README.md`. `publish = false` was
lifted — it only ever blocked `--dry-run`; the real publish is gated by the workflow, not the manifest.

**One exclusion:** `tests/golden_conformance.rs` reads the *shared* golden
(`swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json`) via an `include_str!` path that
climbs out of the crate, so it only compiles inside the monorepo. It is `exclude`d from the tarball so
`cargo test` on the crates.io source builds; CI still runs it from the repo on every change. Follow-up:
teach `scripts/gen-conformance-golden.mjs` to also emit a crate-local copy, then ship the test.

## 4. What was verified

From the PR that lands this (`chore/crates-io-prep`, Part of #1047): `cargo build` / `cargo test
--locked --workspace` green (43 tests, incl. the golden and both lockstep assertions);
`cargo package --list -p fundamental-core` lists the sources, the README, the example, and every test
except the excluded golden; `cargo publish --dry-run --locked -p fundamental-core` green (packaged,
verified). The outputs are pasted in the PR. **No publish was run.**

## 5. Follow-ups (not in this PR)

- `fundamental-platform` and any surface crate: add as workspace members with `version.workspace =
  true`, extend the workflow's `-p` list, same token scope (`fundamental-*`).
- Trusted Publishing on crates.io after the first release; then drop the token from the workflow.
- Fold `crates-io.yml` into `release.yml`'s tag trigger once the Rust plane is on the parity page —
  its own policy PR.
- A crate-local golden so `golden_conformance.rs` ships in the tarball.
