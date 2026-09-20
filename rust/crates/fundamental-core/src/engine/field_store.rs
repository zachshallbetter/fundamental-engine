//! The particle pool — mirrors `packages/core/src/engine/field-store.ts` (the particle side).
//!
//! Minimal for now: owns the free particles and hands out stable ids. Grows toward the JS store
//! (binding, spatial index, snapshot) as those capabilities migrate.

use super::Particle;

/// The pool of free particles the integrator advances each [`step`](super::step).
pub struct FieldStore {
    /// The live particles. Public for the integrator + read paths; order is not significant
    /// (removal is swap-remove, O(1), like the JS store).
    pub particles: Vec<Particle>,
    next_id: u64,
}

impl Default for FieldStore {
    fn default() -> Self {
        FieldStore::new()
    }
}

impl FieldStore {
    pub fn new() -> Self {
        FieldStore {
            particles: Vec::new(),
            next_id: 1,
        }
    }

    /// Add a particle, assigning a stable id if it doesn't carry one. Returns the id.
    pub fn add(&mut self, mut p: Particle) -> u64 {
        if p.id == 0 {
            p.id = self.next_id;
            self.next_id += 1;
        }
        let id = p.id;
        self.particles.push(p);
        id
    }

    /// Remove the particle with `id` (swap-remove, O(1)). Returns whether one was removed.
    pub fn remove(&mut self, id: u64) -> bool {
        if let Some(i) = self.particles.iter().position(|p| p.id == id) {
            self.particles.swap_remove(i);
            true
        } else {
            false
        }
    }

    /// The id the next auto-assigned particle will take (#1043).
    ///
    /// Part of the field's state, not an implementation detail: a snapshot that restored the pool but
    /// not this counter would hand a re-added particle a DIFFERENT id than the original run did, and
    /// every id-keyed thing downstream — an impulse, a receipt, an attribution log — would then name
    /// the wrong matter.
    pub fn next_id(&self) -> u64 {
        self.next_id
    }

    /// Rebuild a pool with an explicit id counter — the restore half of [`next_id`](Self::next_id).
    pub fn from_parts(particles: Vec<Particle>, next_id: u64) -> Self {
        FieldStore {
            particles,
            next_id: next_id.max(1),
        }
    }

    pub fn len(&self) -> usize {
        self.particles.len()
    }

    pub fn is_empty(&self) -> bool {
        self.particles.is_empty()
    }
}
