//! The engine version — the Rust mirror of the JS `FIELD_VERSION` (`packages/core/src/version.ts`)
//! and the Swift/Kotlin constants in their `FieldSnapshot` files.
//!
//! The Rust plane versions in **lockstep** with the rest of the fleet: this constant, the crate
//! version in `Cargo.toml` (via `[workspace.package].version` in `rust/Cargo.toml`), and
//! `packages/core/package.json` must all agree. `tests/version_lockstep.rs` fails the suite if any
//! of the three drifts — the same drift guard the other planes carry (#923, #1047).

/// The engine build / snapshot-format version. Hand-maintained per plane; bumped by the release
/// commit that bumps the seven npm packages (see RELEASING.md).
pub const FIELD_VERSION: &str = "0.10.1";
