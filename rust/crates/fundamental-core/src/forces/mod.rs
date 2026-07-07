//! The force catalog — mirrors `packages/core/src/forces`.
//!
//! Parity target is 36 forces (9 canonical + 8 natural + 19 extended). Landed so far: the canonical
//! nine, the four self-contained natural primitives, and the eight self-contained extended forces — 21.
//! The rest wait on their subsystems (neighbour query, scalar grid, integrator modifier/source passes,
//! field-line hook); see `natural.rs` / `extended.rs` for the per-force breakdown.

pub mod canonical;
pub mod extended;
pub mod natural;

pub use canonical::{Attract, Jet, Repel, Sink, Stream, Swirl, Tether, Viscosity, Wall};
pub use extended::{Buoyancy, Crystallize, Gate, Lens, Pigment, Shear, Warp, Wind};
pub use natural::{Charge, Gravity, Magnetism, Thermal};

use crate::engine::Registry;

/// Register the canonical nine on a registry (§4), in spec order.
///
/// Six are pure/deterministic; `jet`/`wall`/`sink` reach the world through the [`Env`](crate::Env) seam.
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

/// Register the ported natural primitives (§20.10) — opt-in, alongside the nine.
pub fn register_natural_forces(reg: &mut Registry) {
    reg.force(Box::new(Gravity));
    reg.force(Box::new(Charge));
    reg.force(Box::new(Magnetism));
    reg.force(Box::new(Thermal));
}

/// Register the ported class-[A] extended forces (§20.3) — opt-in, alongside the nine.
pub fn register_extended_forces(reg: &mut Registry) {
    reg.force(Box::new(Lens));
    reg.force(Box::new(Gate));
    reg.force(Box::new(Buoyancy));
    reg.force(Box::new(Shear));
    reg.force(Box::new(Crystallize));
    reg.force(Box::new(Wind));
    reg.force(Box::new(Pigment));
    reg.force(Box::new(Warp));
}
