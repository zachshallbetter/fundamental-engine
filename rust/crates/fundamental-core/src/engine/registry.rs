//! The force registry — mirrors `packages/core/src/engine/registry.ts`.

use std::collections::HashMap;

use super::Force;

/// A registry of forces, keyed by token. Forces compose; the engine never changes to add one (§4).
#[derive(Default)]
pub struct Registry {
    forces: HashMap<&'static str, Box<dyn Force>>,
}

impl Registry {
    pub fn new() -> Self {
        Registry {
            forces: HashMap::new(),
        }
    }

    /// Register a force (chainable). Later registration of the same token replaces the earlier.
    pub fn force(&mut self, f: Box<dyn Force>) -> &mut Self {
        self.forces.insert(f.token(), f);
        self
    }

    /// Look up a force by token.
    pub fn get(&self, token: &str) -> Option<&dyn Force> {
        self.forces.get(token).map(|b| b.as_ref())
    }

    /// The registered tokens.
    pub fn tokens(&self) -> impl Iterator<Item = &'static str> + '_ {
        self.forces.keys().copied()
    }

    /// Number of registered forces.
    pub fn len(&self) -> usize {
        self.forces.len()
    }

    pub fn is_empty(&self) -> bool {
        self.forces.is_empty()
    }

    /// A registry with the standard catalog registered: the canonical nine plus the ported natural +
    /// extended forces (21 total). Each is opt-in — a body only feels a force it names in its tokens —
    /// so a fuller registry never changes a body that doesn't ask.
    pub fn standard() -> Self {
        let mut r = Registry::new();
        crate::forces::register_core_forces(&mut r);
        crate::forces::register_natural_forces(&mut r);
        crate::forces::register_extended_forces(&mut r);
        r
    }
}
