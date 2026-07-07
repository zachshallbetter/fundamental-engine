//! The force catalog — mirrors `packages/core/src/forces`.

pub mod canonical;

pub use canonical::{Attract, Repel, Stream, Swirl, Tether, Viscosity};

use crate::engine::Registry;

/// Register the deterministic canonical forces on a registry (§4).
///
/// Milestone 1 covers the six the cross-plane golden pins. `jet`/`wall`/`sink` (stochastic/stateful)
/// and the extended + natural sets land with their supporting `Env` services.
pub fn register_core_forces(reg: &mut Registry) {
    reg.force(Box::new(Attract));
    reg.force(Box::new(Repel));
    reg.force(Box::new(Swirl));
    reg.force(Box::new(Stream));
    reg.force(Box::new(Viscosity));
    reg.force(Box::new(Tether));
}
