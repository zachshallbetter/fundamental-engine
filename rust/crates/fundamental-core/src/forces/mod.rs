//! The force catalog — mirrors `packages/core/src/forces`.

pub mod canonical;

pub use canonical::{Attract, Jet, Repel, Sink, Stream, Swirl, Tether, Viscosity, Wall};

use crate::engine::Registry;

/// Register the canonical nine on a registry (§4), in spec order.
///
/// Six are pure/deterministic; `jet`/`wall`/`sink` reach the world through the [`Env`](crate::Env)
/// seam. The extended + natural sets follow.
pub fn register_core_forces(reg: &mut Registry) {
    reg.force(Box::new(Attract));
    reg.force(Box::new(Jet));
    reg.force(Box::new(Tether));
    reg.force(Box::new(Wall));
    reg.force(Box::new(Stream));
    reg.force(Box::new(Repel));
    reg.force(Box::new(Viscosity));
    reg.force(Box::new(Swirl));
    reg.force(Box::new(Sink));
}
