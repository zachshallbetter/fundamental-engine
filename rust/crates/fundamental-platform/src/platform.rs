//! [`FieldPlatform`] — the host, the scheduler and a core field, wired together.
//!
//! This is the thing a headless consumer actually drives: bind records, run frames, read the result
//! back *attributed to the records it came from*.

use fundamental_core::engine::{step, Body, Env, FieldStore, Particle, Registry};
use fundamental_core::math::Vec3;
use fundamental_core::record::Rng;

use crate::host::FieldHost;
use crate::scheduler::{FrameReport, FrameScheduler, Phase, PhaseViolation};

/// How a platform runs.
#[derive(Clone, Copy, Debug)]
pub struct PlatformOptions {
    /// Turn a phase violation into a hard error rather than a collected report.
    pub strict: bool,
    /// Seed for the field's RNG. Fixed by default — a headless run is reproducible or it is not
    /// evidence.
    pub seed: u32,
    /// Particles seeded into the field at construction, spread deterministically over the volume.
    pub particles: usize,
}

impl Default for PlatformOptions {
    fn default() -> Self {
        PlatformOptions {
            strict: false,
            seed: 1,
            particles: 0,
        }
    }
}

/// A body's reading, attributed back to the host record that produced it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Reading {
    /// Index into the host's bodies — the same order [`FieldHost::bodies`] returned.
    pub index: usize,
    /// Gathered density at this body: the raw signal a CMS ranks on.
    pub count: f64,
    /// How much matter this body has absorbed, for the accreting forces.
    pub accreted: u32,
}

/// Host + scheduler + field.
pub struct FieldPlatform<H: FieldHost> {
    pub host: H,
    pub scheduler: FrameScheduler,
    pub store: FieldStore,
    pub bodies: Vec<Body>,
    pub env: Env,
    pub forces: Registry,
}

impl<H: FieldHost> FieldPlatform<H> {
    pub fn new(host: H, options: PlatformOptions) -> Self {
        let volume = host.volume();
        let mut scheduler = FrameScheduler::new();
        scheduler.strict = options.strict;

        let mut env = Env {
            volume,
            rng: Rng::seeded(options.seed),
            ..Env::default()
        };
        let mut store = FieldStore::new();
        // Deterministic spread, not a random one: two runs of the same build must start identically,
        // and a seeded shuffle would still depend on how many draws happened before it.
        for i in 0..options.particles {
            let t = (i as f64 + 0.5) / options.particles.max(1) as f64;
            let golden = 0.618_033_988_749_895_f64;
            let u = ((i as f64) * golden).fract();
            store.add(Particle {
                position: Vec3::new(u * volume.x, t * volume.y, 0.0),
                ..Default::default()
            });
        }
        let bodies = host.bodies();
        env.frame_n = 0;

        FieldPlatform {
            host,
            scheduler,
            store,
            bodies,
            env,
            forces: Registry::standard(),
        }
    }

    /// Run one frame: the scheduler's six phases, with the field's own step inside `compute`.
    ///
    /// Bodies are re-read from the host in `discover`, so a host whose records changed between frames
    /// is honoured without the caller re-wiring anything.
    pub fn tick(&mut self) -> Result<FrameReport, PhaseViolation> {
        let frame = self.scheduler.frame() + 1;
        let now = self.host.now(frame);

        // discover — re-read the bodies the host currently has, carrying over the state the ENGINE
        // owns rather than the host. `count` is a per-frame density accumulator the integrator zeroes
        // anyway, but `accreted` is genuinely cross-frame: a sink that has swallowed matter for two
        // hundred frames must not be handed back an empty one just because the host re-described its
        // geometry. Carried by position, which is the order the host guarantees.
        let carried: Vec<u32> = self.bodies.iter().map(|b| b.accreted).collect();
        self.bodies = self.host.bodies();
        for (i, b) in self.bodies.iter_mut().enumerate() {
            if let Some(&a) = carried.get(i) {
                b.accreted = a;
            }
        }

        // compute — advance the field
        self.env.t = now;
        step(
            &mut self.store,
            &mut self.bodies,
            &mut self.env,
            &self.forces,
        );

        // …then run the registered handlers through every phase, so a host's own work interleaves in
        // the documented order.
        self.scheduler.tick(now)
    }

    /// Run `frames` frames, stopping early on a violation in strict mode.
    pub fn run(&mut self, frames: usize) -> Result<(), PhaseViolation> {
        for _ in 0..frames {
            self.tick()?;
        }
        Ok(())
    }

    /// Register a phase handler. See [`FrameScheduler::on`].
    pub fn on(
        &mut self,
        phase: Phase,
        handler: impl for<'a> FnMut(&crate::scheduler::FrameContext<'a>) + 'static,
    ) -> u64 {
        self.scheduler.on(phase, handler)
    }

    /// Read every body back, attributed to its host index.
    pub fn readings(&self) -> Vec<Reading> {
        self.bodies
            .iter()
            .enumerate()
            .map(|(index, b)| Reading {
                index,
                count: b.count,
                accreted: b.accreted,
            })
            .collect()
    }

    /// Readings ranked by gathered density, strongest first — the CMS "what matters here" read.
    ///
    /// Ties keep host order, so a rebuild of unchanged content produces an unchanged ranking rather
    /// than shuffling equal rows.
    pub fn ranked(&self) -> Vec<Reading> {
        let mut out = self.readings();
        out.sort_by(|a, b| {
            b.count
                .partial_cmp(&a.count)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.index.cmp(&b.index))
        });
        out
    }
}
