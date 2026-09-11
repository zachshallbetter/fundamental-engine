//! A uniform-grid spatial hash for neighbour queries (§20.1 class \[B\]) — mirrors
//! `packages/core/src/engine/spatial-hash.ts`. Makes particle↔particle forces O(n·k) instead of O(n²).
//!
//! The Rust plane builds a **frame-start snapshot**: at the top of each [`step`](super::step) the
//! neighbourhood copies every particle's read-only state ([`NeighborSample`]) and indexes it. Forces
//! read from the snapshot, so neighbour data is consistent and order-independent across the frame. When
//! a particle is processed it has not integrated yet (that happens at the end of its own iteration), so
//! its own sample sits at distance 0 — the forces' existing `d < 1e-6` guards skip self exactly as the
//! JS engine's identity check does.

use super::Particle;
use crate::math::Vec3;
use std::collections::HashMap;

/// The read-only view of a particle a neighbour force needs.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NeighborSample {
    pub id: u64,
    pub pos: Vec3,
    pub vel: Vec3,
    pub size: f64,
    pub species: i32,
}

/// A frame-start snapshot of the particle pool, indexed by a uniform grid for radius queries.
#[derive(Clone, Debug)]
pub struct Neighborhood {
    cell: f64,
    samples: Vec<NeighborSample>,
    bins: HashMap<(i64, i64), Vec<usize>>,
}

impl Default for Neighborhood {
    fn default() -> Self {
        Neighborhood::new(64.0)
    }
}

impl Neighborhood {
    pub fn new(cell: f64) -> Self {
        Neighborhood {
            cell: if cell > 0.0 { cell } else { 64.0 },
            samples: Vec::new(),
            bins: HashMap::new(),
        }
    }

    #[inline]
    fn key(&self, x: f64, y: f64) -> (i64, i64) {
        (
            (x / self.cell).floor() as i64,
            (y / self.cell).floor() as i64,
        )
    }

    /// Rebuild the snapshot + index from the live pool (bins stay planar; the query filters by true 3D
    /// distance).
    pub fn rebuild(&mut self, particles: &[Particle]) {
        self.samples.clear();
        self.bins.clear();
        self.samples.reserve(particles.len());
        for p in particles {
            let i = self.samples.len();
            self.samples.push(NeighborSample {
                id: p.id,
                pos: p.position,
                vel: p.velocity,
                size: p.size,
                species: p.species,
            });
            let k = self.key(p.position.x, p.position.y);
            self.bins.entry(k).or_default().push(i);
        }
    }

    /// Samples within radius `r` of `at`, filtered by true 3D distance. Includes any sample at the
    /// query point (the caller's own frame-start sample) — force distance guards skip it.
    pub fn near(&self, at: Vec3, r: f64) -> Vec<NeighborSample> {
        let mut out = Vec::new();
        if self.samples.is_empty() {
            return out;
        }
        let r2 = r * r;
        let (min_cx, min_cy) = self.key(at.x - r, at.y - r);
        let (max_cx, max_cy) = self.key(at.x + r, at.y + r);
        for cx in min_cx..=max_cx {
            for cy in min_cy..=max_cy {
                let Some(bin) = self.bins.get(&(cx, cy)) else {
                    continue;
                };
                for &i in bin {
                    let s = self.samples[i];
                    if (s.pos - at).length_sq() <= r2 {
                        out.push(s);
                    }
                }
            }
        }
        out
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }
}
