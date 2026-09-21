//! The reading layer — turn a settled field into consumable outputs (#1044).
//!
//! This is the Rust plane's product surface. The engine's job is to settle; this module's job is to
//! answer the three questions a CMS actually asks of a settled field:
//!
//! - **[`scores`]** — what matters here, ranked
//! - **[`clusters`]** — what belongs together
//! - **[`relations`]** — what relates to what
//!
//! Every reading is attributed back to the caller's own index, because a score that cannot name its
//! record is not usable. And every reading is taken from a field that has already settled — see the
//! note in [`scores`] about `count` being a per-frame measure, which is the one way to misread this.

pub mod clusters;
pub mod relations;
pub mod scores;

pub use clusters::{attribute, clusters, Cluster};
pub use relations::{related_to, relations, Relation};
pub use scores::{ranked, scores, Score};
