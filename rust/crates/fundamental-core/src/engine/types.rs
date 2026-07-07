//! Core engine types — mirrors `packages/core/src/engine/types.ts` and `swift/.../Engine/Types.swift`.
//!
//! The physics primitives: [`Body`] (a force source), [`Particle`] (a free agent), [`Env`] (the
//! per-apply environment the integrator hands each force), and the [`Force`] trait.

use crate::math::Vec3;
use crate::record::Rng;

/// A side effect a force requests during its apply, applied by the integrator with full context.
///
/// **Effects-as-data** (the Rust plane's take on the JS `Env` service closures): a force never
/// reaches out to mutate the world directly — it emits an `Effect`, and the integrator resolves it.
/// This keeps the hot loop borrow-clean, and — because effects are *values* — it's exactly the
/// substrate the Field Receipts thesis wants: a step's effects can be recorded, replayed, attributed.
#[derive(Clone, Debug, PartialEq)]
pub enum Effect {
    /// A visual spark at a point (an impact flash). Headless hosts record it; render hosts draw it.
    Spark {
        at: Vec3,
        /// Impact power (drives count/size on a render host).
        power: f64,
        /// Spark tint (`#rrggbb`); `None` = the force's canon colour.
        color: Option<String>,
    },
}

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
    /// The index (into the current `bodies` slice) of the sink body holding this particle, or `None`
    /// (§6.9). While captured, the particle drifts to that body's core and skips the force pass. Valid
    /// only within a solve, where the body set is stable — the integrator clears it on release.
    pub cap: Option<usize>,
    /// Signed charge `q`, for `charge` / `magnetism` (§20.10). 0 = neutral (ignores charge fields).
    pub charge: f64,
    /// Carried pigment (`#rrggbb`), conserved colour transport (§20.8). `None` until a `pigment` body
    /// stains it.
    pub color: Option<String>,
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
            cap: None,
            charge: 0.0,
            color: None,
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
    /// The gravitational / charge source scalar `M ≥ 0` (§20.10). (JS `M`.) The natural inverse-square
    /// forces are sourced by this, not `strength`.
    pub source_mass: f64,

    // ── geometry ────────────────────────────────────────────────────────
    /// Box centre (world).
    pub center: Vec3,
    /// Box half-extents (world). `.x`/`.y` are the JS `hw`/`hh`.
    pub half_extents: Vec3,

    // ── warp / wormhole (§22.3) ─────────────────────────────────────────
    /// Whether the engine has resolved this warp body's paired throat. `warp` no-ops until set.
    pub warp_has: bool,
    /// The paired throat's world centre (JS `warpX`/`warpY`). Matter emerges just outside it.
    pub warp_target: Vec3,
    /// Twist applied to the relocated offset + velocity (JS `twist`).
    pub twist: f64,
    /// Scale applied to the emergence radius (JS `warpScale`).
    pub warp_scale: f64,

    // ── feedback / density (§8) ─────────────────────────────────────────
    /// Whether this body is an active force source this frame (JS `vis`).
    pub visible: bool,
    /// Whether this body samples local density for two-way feedback.
    pub feedback: bool,
    /// Per-frame density accumulator — how much matter is near this body. Zeroed at the top of
    /// every [`step`](super::step); the raw signal the CMS "score" layer reads (importance ≈ how
    /// much of the field a body gathers). (JS `count`.)
    pub count: f64,

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
            source_mass: 1.0,
            center: Vec3::ZERO,
            half_extents: Vec3::ZERO,
            warp_has: false,
            warp_target: Vec3::ZERO,
            twist: 0.0,
            warp_scale: 1.0,
            visible: true,
            feedback: false,
            count: 0.0,
            accreted: 0,
            tint: None,
        }
    }
}

/// The per-apply environment the integrator hands each force.
///
/// Deterministic-by-construction: `dt` is fixed and the RNG is seeded. Forces reach the world only
/// through the seam here — [`rng`](Env::rng) for stochastic draws, [`spark`](Env::spark) and
/// [`request_capture`](Env::request_capture) to emit effects — never by mutating it directly.
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

    // ── the force→world seam ────────────────────────────────────────────
    /// The seeded random source every stochastic draw flows through (jet cone, wander, spawn).
    pub rng: Rng,
    /// Effects emitted this step (sparks). The integrator clears it at the top of each [`step`]; the
    /// caller drains it after for rendering/receipts. (`step` = [`super::step`].)
    pub effects: Vec<Effect>,
    /// Set by a force (`sink`) to request that the integrator capture the current particle into the
    /// current body. Read + reset by the integrator immediately after each force apply.
    pub capture_request: bool,
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
            rng: Rng::default(),
            effects: Vec::new(),
            capture_request: false,
        }
    }
}

impl Env {
    /// The next uniform random value in `[0, 1)`, from the seeded source.
    #[inline]
    pub fn rng(&mut self) -> f64 {
        self.rng.next_f64()
    }

    /// Emit a spark effect (an impact flash) at a point. Recorded in [`effects`](Env::effects).
    #[inline]
    pub fn spark(&mut self, at: Vec3, power: f64, color: Option<String>) {
        self.effects.push(Effect::Spark { at, power, color });
    }

    /// Request that the integrator capture the current particle into the current body (`sink`).
    #[inline]
    pub fn request_capture(&mut self) {
        self.capture_request = true;
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

    /// Apply this force to a free particle. Mutates the particle; reaches the world only through the
    /// [`Env`] seam (`env.rng()`, `env.spark(…)`, `env.request_capture()`).
    fn apply(&self, body: &Body, particle: &mut Particle, env: &mut Env);
}
