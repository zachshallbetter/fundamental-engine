//! The layering invariant: `core ← platform`, never up (#1046).
//!
//! This is the one property the whole crate split exists to protect. `fundamental-core` is the
//! physics and must stay runnable with no environment at all — the moment it reaches up into a host
//! layer, "headless" stops being true and the conformance golden stops being a statement about the
//! physics alone.
//!
//! Checked against the manifests rather than the code, because that is where the violation would
//! actually land: a `use` of a crate you do not depend on does not compile, so the dependency edge is
//! the thing to forbid.

use std::fs;

fn manifest(name: &str) -> String {
    let p = format!("{}/../{}/Cargo.toml", env!("CARGO_MANIFEST_DIR"), name);
    fs::read_to_string(&p).unwrap_or_else(|e| panic!("cannot read {p}: {e}"))
}

#[test]
fn core_does_not_depend_on_platform() {
    let core = manifest("fundamental-core");
    assert!(
        !core.contains("fundamental-platform"),
        "fundamental-core must not depend on fundamental-platform — the arrow points one way"
    );
}

#[test]
fn core_has_no_runtime_dependencies_at_all() {
    // The stronger claim the core actually makes. Its `[dependencies]` section is empty; only
    // dev-dependencies (serde, for parsing the conformance golden) exist.
    let core = manifest("fundamental-core");
    let deps = core
        .split("[dependencies]")
        .nth(1)
        .expect("core manifest has a [dependencies] section");
    let body = deps.split('[').next().unwrap_or("");
    let real: Vec<&str> = body
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect();
    assert!(
        real.is_empty(),
        "fundamental-core must have zero runtime dependencies, found: {real:?}"
    );
}

#[test]
fn platform_depends_on_core_and_nothing_else() {
    let plat = manifest("fundamental-platform");
    let deps = plat
        .split("[dependencies]")
        .nth(1)
        .expect("platform manifest has a [dependencies] section");
    let body = deps.split("\n[").next().unwrap_or("");
    let real: Vec<&str> = body
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect();
    assert_eq!(
        real.len(),
        1,
        "platform should depend on exactly one crate, found: {real:?}"
    );
    assert!(
        real[0].starts_with("fundamental-core"),
        "and it should be fundamental-core, found: {}",
        real[0]
    );
}
