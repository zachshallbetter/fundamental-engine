//! **Fundamental** — a reciprocal relational field engine. Rust core.
//!
//! Bodies bend the field; the field's local density bends them back (reciprocity). This crate is the
//! **DOM-free, renderer-agnostic engine** — the Rust plane of the Fundamental fleet, mirroring the JS
//! reference core (`packages/core`) and the Swift/Kotlin ports at parity.
//!
//! Unlike the DOM/Swift/Kotlin planes, whose bodies wrap a UI element (`view: UIView?`), the Rust
//! plane is built for **headless** hosts — servers, data pipelines, CMS runtimes, analysis. Here a
//! *body is a data record, not a widget*. The four Natural Fields become a relational solver:
//! **Gravity→importance, Electromagnetic→polarity/signal, Strong→binding, Weak→transformation**.
//!
//! # Design commitments
//! - **f64 everywhere.** The Rust plane reproduces the JS f64 engine bit-for-bit — exact deterministic
//!   snapshot/replay, tight conformance tolerance, trustworthy numerics for ranking/analysis.
//! - **Deterministic by construction.** Fixed `dt`, seeded RNG (when stochastic forces land). This is
//!   the load-bearing property for the "Field Receipts" auditability thesis — receipts become a thin
//!   opt-in layer, never a retrofit.
//! - **Zero runtime dependencies.** Same contract as the JS core.
//!
//! # Parity gate
//! The physics is pinned by the shared **conformance golden** (`scripts/gen-conformance-golden.mjs`):
//! 120 force-apply cases, each with the frame-0 velocity delta the JS engine computes. Every plane
//! reproduces every `dv`. See `tests/golden_conformance.rs`.
//!
//! # Status
//! Milestone 1 — the six deterministic canonical forces (attract, repel, swirl, stream, tether,
//! viscosity) pass the shared golden. The full 36-force catalog, integrator/store, spatial hash,
//! snapshot/query, and the CMS-facing reading layer (scores/clusters/relations) follow.

pub mod engine;
pub mod forces;
pub mod math;

pub use engine::{step, Body, Env, FieldStore, Force, Formation, Particle, Registry};
pub use math::Vec3;
