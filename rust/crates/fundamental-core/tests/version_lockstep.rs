//! Drift guard — the Rust mirror of the JS `version.test.ts` (#693), Swift `VersionLockstepTests`,
//! and Kotlin `VersionLockstepTests` (#923). Two assertions:
//!
//! 1. `FIELD_VERSION` == the crate version (`Cargo.toml`), always — the crates.io release and the
//!    constant stamped onto captures can never disagree.
//! 2. `FIELD_VERSION` == `packages/core/package.json` `version` — the canonical engine version, the
//!    single source of truth the release bump edits. Read at runtime, `CARGO_MANIFEST_DIR`-relative,
//!    so it runs from the monorepo checkout (locally and in `rust.yml` / `crates-io.yml`). On the
//!    published crates.io source the file does not exist and this half is skipped with a note —
//!    unlike the golden test, this file ships in the tarball because assertion 1 is always useful.

use fundamental_core::FIELD_VERSION;
use std::path::Path;

#[test]
fn field_version_matches_crate_version() {
    assert_eq!(
        FIELD_VERSION,
        env!("CARGO_PKG_VERSION"),
        "update FIELD_VERSION in rust/crates/fundamental-core/src/version.rs to match \
         [workspace.package].version in rust/Cargo.toml"
    );
}

#[test]
fn field_version_matches_packages_core_package_json() {
    // <repo>/rust/crates/fundamental-core → three levels up → <repo>
    let pkg = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../packages/core/package.json");
    if !pkg.exists() {
        eprintln!(
            "skipping: {} not found — not a monorepo checkout (published crate source?)",
            pkg.display()
        );
        return;
    }
    let json = std::fs::read_to_string(&pkg).expect("read packages/core/package.json");
    let version = json
        .lines()
        .map(str::trim)
        .find_map(|l| l.strip_prefix("\"version\":"))
        .map(|v| v.trim().trim_end_matches(',').trim_matches('"').to_string())
        .expect("packages/core/package.json has a top-level \"version\"");
    assert_eq!(
        FIELD_VERSION, version,
        "update FIELD_VERSION in rust/crates/fundamental-core/src/version.rs (and \
         [workspace.package].version in rust/Cargo.toml) to match the release \
         (packages/core/package.json is {version})"
    );
}
