//! Core engine types — mirrors `packages/core/src/engine/types.ts` and `swift/.../Engine/Types.swift`.
//!
//! The physics primitives: [`Body`] (a force source), [`Particle`] (a free agent), [`Env`] (the
//! per-apply environment the integrator hands each force), and the [`Force`] trait.

use crate::math::Vec3;

/// The active, eased formation (§7) — ambient bias applied field-wide.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Formation {
    pub drift_x: f64,
    pub wander: f64,
    /// Tangential swirl coefficient — bends radial wells into orbits.
    pub orbit: f64,
    pub spread: f64,
    pub conv: f64,
}

impl Default for Formation {
    fn default() -> Self {
        Formation {
            drift_x: 0.0,
            wander: 0.0,
            orbit: 0.0,
            spread: 0.0,
            conv: 0.0,
        }
    }
}

/// A free particle — the lightest agent.
///
/// The integrator mutates particles in place. All positions/velocities are 3D; on 2D fields `z` = 0.
#[derive(Clone, Debug)]
pub struct Particle {
    pub position: Vec3,
    pub velocity: Vec3,
    /// Inertial mass — 1 = nominal (§21).
    pub mass: f64,
    /// ∈ [0,1]; drives colour (toward accent), size, and glow (§2.2).
    pub heat: f64,
    /// Render-radius basis.
    pub size: f64,
    /// Stable id assigned at pool creation (0 until a store assigns it).
    pub id: u64,
}

impl Default for Particle {
    fn default() -> Self {
        Particle {
            position: Vec3::ZERO,
            velocity: Vec3::ZERO,
            mass: 1.0,
            heat: 0.0,
            size: 1.0,
            id: 0,
        }
    }
}

/// A registered body acting as a force source (§3.1).
///
/// On headless hosts a body is backed by a *data record*, not a UI element — the Rust plane's
/// defining inversion. The physical fields below (`strength`/`range`/`heading`/…) are what the
/// forces read; higher layers derive them from domain data (importance→`mass`, stance→charge, …).
#[derive(Clone, Debug)]
pub struct Body {
    /// Space-joined force ids (they compose, §4).
    pub tokens: Vec<String>,

    // ── field parameters ────────────────────────────────────────────────
    pub strength: f64,
    pub range: f64,
    /// Absorption radius (sink/accretion).
    pub absorb_r: f64,
    /// Accretion capacity before release.
    pub capacity: f64,
    pub spin: f64,
    /// Heading in 3D — dipole axis, orbit axis, jet direction. `heading.x`/`.y` are the JS `ux`/`uy`.
    pub heading: Vec3,
    /// Engaged / "on" state — widens range and boosts strength per the spec.
    pub engaged: bool,

    // ── geometry ────────────────────────────────────────────────────────
    /// Box centre (world).
    pub center: Vec3,
    /// Box half-extents (world). `.x`/`.y` are the JS `hw`/`hh`.
    pub half_extents: Vec3,

    // ── accretion state ─────────────────────────────────────────────────
    pub accreted: u32,

    /// Optional tint (`#rrggbb`) — a tagged body throws its tag's colour.
    pub tint: Option<String>,
}

impl Default for Body {
    fn default() -> Self {
        Body {
            tokens: Vec::new(),
            strength: 1.0,
            range: 300.0,
            absorb_r: 64.0,
            capacity: 60.0,
            spin: 1.0,
            heading: Vec3::new(1.0, 0.0, 0.0),
            engaged: false,
            center: Vec3::ZERO,
            half_extents: Vec3::ZERO,
            accreted: 0,
            tint: None,
        }
    }
}

/// The per-apply environment the integrator hands each force.
///
/// Deterministic-by-construction: `dt` is fixed and (once stochastic forces land) the RNG is seeded.
/// The service closures (spark/spawn/neighbours/grid) arrive with the later force set; the six
/// deterministic canonical forces read only the geometry below.
#[derive(Clone, Debug)]
pub struct Env {
    /// Vector from particle toward body: `body.center − particle.position`. (JS `dx`/`dy`/`dz`.)
    pub vector: Vec3,
    /// `|vector|`, clamped ≥ 1.
    pub dist: f64,
    /// The active, eased formation (§7).
    pub form: Formation,
    /// World volume (width, height, depth). Depth = 0 on 2D fields.
    pub volume: Vec3,
    /// Elapsed time in seconds.
    pub t: f64,
    /// Frame counter.
    pub frame_n: u64,
    /// Integration step: 1 a frame, 0 under reduced motion (§2.2/§18).
    pub dt: f64,
    /// Velocity cap / "speed of light" (§20.10).
    pub c: f64,
    /// Gravitational constant (§20.10).
    pub g: f64,
    /// Recent scroll speed (eased); 0 when inactive.
    pub scroll_v: f64,
}

impl Default for Env {
    fn default() -> Self {
        Env {
            vector: Vec3::ZERO,
            dist: 1.0,
            form: Formation::default(),
            volume: Vec3::ZERO,
            t: 0.0,
            frame_n: 0,
            dt: 1.0,
            c: 12.0,
            g: 1.0,
            scroll_v: 0.0,
        }
    }
}

/// A force — an independent per-frame velocity contribution. The engine never changes to add one
/// (§4); a force is registered on a [`Registry`](super::Registry) and composed by token.
pub trait Force: Send + Sync {
    /// The registry key (`"attract"`, `"repel"`, …).
    fn token(&self) -> &'static str;

    /// Human label.
    fn label(&self) -> &'static str;

    /// True if this force *replaces* velocity (reflection/rotation/relaunch) rather than adding an
    /// acceleration — first-class mass must not scale it (§21.3). Default false.
    fn kinematic(&self) -> bool {
        false
    }

    /// Apply this force to a free particle (mutates the particle).
    fn apply(&self, body: &Body, particle: &mut Particle, env: &Env);
}
