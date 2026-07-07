//! The engine — physics primitives, the force trait, and the registry.
//! Mirrors `packages/core/src/engine` and `swift/.../Engine`.

pub mod registry;
pub mod types;

pub use registry::Registry;
pub use types::{Body, Env, Force, Formation, Particle};
