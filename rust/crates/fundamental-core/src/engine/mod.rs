//! The engine — physics primitives, the force trait, the registry, the store, and the integrator.
//! Mirrors `packages/core/src/engine` and `swift/.../Engine`.

pub mod field_store;
pub mod integrator;
pub mod registry;
pub mod types;

pub use field_store::FieldStore;
pub use integrator::{step, EDGE, FRICTION, HEAT_DECAY};
pub use registry::Registry;
pub use types::{Body, Effect, Env, Force, Formation, Particle};
