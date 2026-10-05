//! A scalar field on a uniform grid — the backing store for the class-\[C\] field-buffer forces
//! (§20.1): `diffuse` (heat/concentration, `∂φ/∂t = D∇²φ`), `propagate` (a travelling wave,
//! `∂²φ/∂t² = c²∇²φ`) and `memory` (slow-decay occupancy). Particles `deposit` into it and read its
//! `gradient`; the engine advances it once per frame with [`ScalarGrid::step`].
//!
//! Mirrors `packages/core/src/engine/scalar-grid.ts` and the Swift `ScalarGridImpl`, with one
//! deliberate difference: the buffers are `f64`, not `f32`. The whole Rust plane is f64 by design (it
//! is held to the shared cross-plane golden at f64 tolerance), and a grid is no exception — so a long
//! diffusion run will not be bit-identical to the JS one. The schemes, constants and clamps are.

/// How a grid advances each frame. The field picks by grid NAME — see [`GridMode::for_name`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GridMode {
    /// Explicit heat equation with a decay term; `D` clamped to the forward scheme's stable range.
    Diffuse,
    /// Second-order leapfrog over a previous buffer; `c²` clamped to the CFL limit, lightly damped.
    Wave,
    /// `Diffuse` with a barely-blurring, slowly-fading parameterization.
    Memory,
    /// **Not a dynamical scheme**: a raster the engine writes and then leaves alone. [`step`] is a
    /// no-op, so a held grid never blurs, decays or advances — the backing store for a declared
    /// potential (#443), filled through [`ScalarGrid::fill_from`].
    ///
    /// [`step`]: ScalarGrid::step
    Held,
}

impl GridMode {
    /// The scheme a grid name selects, mirroring the JS field's picker exactly: `wave…` is a wave,
    /// `memory…` is slow decay, `potential:…` is a held raster, and anything else diffuses.
    pub fn for_name(name: &str) -> GridMode {
        if name.starts_with("wave") {
            GridMode::Wave
        } else if name.starts_with("memory") {
            GridMode::Memory
        } else if name.starts_with("potential:") {
            GridMode::Held
        } else {
            GridMode::Diffuse
        }
    }
}

/// A uniform scalar grid over the field's volume. Pure — no host, no allocation per frame beyond the
/// two buffers it owns — so every operation is directly testable.
#[derive(Clone, Debug)]
pub struct ScalarGrid {
    pub mode: GridMode,
    pub cell: f64,
    w: f64,
    h: f64,
    cols: usize,
    rows: usize,
    cur: Vec<f64>,
    nxt: Vec<f64>,
    prev: Vec<f64>,
}

impl ScalarGrid {
    pub fn new(w: f64, h: f64, mode: GridMode, cell: f64) -> Self {
        let cell = if cell > 0.0 { cell } else { 32.0 };
        let (cols, rows) = Self::dims(w, h, cell);
        let n = cols * rows;
        ScalarGrid {
            mode,
            cell,
            w,
            h,
            cols,
            rows,
            cur: vec![0.0; n],
            nxt: vec![0.0; n],
            prev: vec![0.0; n],
        }
    }

    fn dims(w: f64, h: f64, cell: f64) -> (usize, usize) {
        let cols = ((w / cell).ceil() as isize + 1).max(2) as usize;
        let rows = ((h / cell).ceil() as isize + 1).max(2) as usize;
        (cols, rows)
    }

    pub fn cols(&self) -> usize {
        self.cols
    }
    pub fn rows(&self) -> usize {
        self.rows
    }

    #[inline]
    fn clamp_col(&self, ix: isize) -> usize {
        ix.clamp(0, self.cols as isize - 1) as usize
    }
    #[inline]
    fn clamp_row(&self, iy: isize) -> usize {
        iy.clamp(0, self.rows as isize - 1) as usize
    }
    /// The current value at a clamped cell — a Neumann (zero-flux) boundary.
    #[inline]
    fn at(&self, ix: isize, iy: isize) -> f64 {
        self.cur[self.clamp_row(iy) * self.cols + self.clamp_col(ix)]
    }

    /// Bilinear sample in pixel space.
    pub fn sample(&self, x: f64, y: f64) -> f64 {
        let gx = x / self.cell;
        let gy = y / self.cell;
        let ix = gx.floor();
        let iy = gy.floor();
        let fx = gx - ix;
        let fy = gy - iy;
        let (ix, iy) = (ix as isize, iy as isize);
        let top = self.at(ix, iy) * (1.0 - fx) + self.at(ix + 1, iy) * fx;
        let bot = self.at(ix, iy + 1) * (1.0 - fx) + self.at(ix + 1, iy + 1) * fx;
        top * (1.0 - fy) + bot * fy
    }

    /// Add `amount` to the nearest cell.
    pub fn deposit(&mut self, x: f64, y: f64, amount: f64) {
        let ix = self.clamp_col((x / self.cell).round() as isize);
        let iy = self.clamp_row((y / self.cell).round() as isize);
        let cols = self.cols;
        self.cur[iy * cols + ix] += amount;
    }

    /// The current peak across the field — for normalising a heatmap to [0, 1].
    pub fn max(&self) -> f64 {
        self.cur.iter().fold(0.0, |m, &v| if v > m { v } else { m })
    }

    /// Central-difference gradient ∇φ in pixel space (points up-slope).
    pub fn gradient(&self, x: f64, y: f64) -> (f64, f64) {
        let h = self.cell;
        (
            (self.sample(x + h, y) - self.sample(x - h, y)) / (2.0 * h),
            (self.sample(x, y + h) - self.sample(x, y - h)) / (2.0 * h),
        )
    }

    /// Advance one frame in this grid's mode.
    pub fn step(&mut self) {
        match self.mode {
            // A held grid is the declared-potential raster: the engine wrote it and it stays exactly
            // as written. Stepping would blur and decay a terrain the host declared.
            GridMode::Held => {}
            GridMode::Wave => self.step_wave(0.25, 0.002),
            GridMode::Memory => self.step_diffuse(0.03, 0.004), // barely blur, fade slowly
            GridMode::Diffuse => self.step_diffuse(0.18, 0.01),
        }
    }

    /// Explicit heat equation `φ' = (φ + D·∇²φ)·(1 − decay)`.
    pub fn step_diffuse(&mut self, d: f64, decay: f64) {
        let dc = d.clamp(0.0, 0.24); // forward-scheme stability
        let keep = 1.0 - decay;
        for iy in 0..self.rows as isize {
            for ix in 0..self.cols as isize {
                let i = iy as usize * self.cols + ix as usize;
                let lap = self.at(ix - 1, iy) + self.at(ix + 1, iy) + self.at(ix, iy - 1)
                    + self.at(ix, iy + 1)
                    - 4.0 * self.cur[i];
                self.nxt[i] = (self.cur[i] + dc * lap) * keep;
            }
        }
        std::mem::swap(&mut self.cur, &mut self.nxt);
    }

    /// Leapfrog wave `φ' = 2φ − φ_prev + c²·∇²φ`, lightly damped.
    pub fn step_wave(&mut self, c2: f64, damping: f64) {
        let cc = c2.clamp(0.0, 0.5); // CFL limit
        let keep = 1.0 - damping;
        for iy in 0..self.rows as isize {
            for ix in 0..self.cols as isize {
                let i = iy as usize * self.cols + ix as usize;
                let lap = self.at(ix - 1, iy) + self.at(ix + 1, iy) + self.at(ix, iy - 1)
                    + self.at(ix, iy + 1)
                    - 4.0 * self.cur[i];
                self.nxt[i] = (2.0 * self.cur[i] - self.prev[i] + cc * lap) * keep;
            }
        }
        // rotate: prev ← cur, cur ← nxt, and the old prev becomes the next scratch buffer
        std::mem::swap(&mut self.prev, &mut self.cur); // prev = old cur, cur = old prev
        std::mem::swap(&mut self.cur, &mut self.nxt); // cur = nxt, nxt = old prev
    }

    /// Fade every cell toward zero by `rate` ∈ [0,1] (`1` clears) — a host-authored decay on top of
    /// the grid's own mode stepping. Touches the current buffer only.
    pub fn decay(&mut self, rate: f64) {
        let k = if rate <= 0.0 {
            1.0
        } else if rate >= 1.0 {
            0.0
        } else {
            1.0 - rate
        };
        if k == 1.0 {
            return;
        }
        for v in self.cur.iter_mut() {
            *v *= k;
        }
    }

    /// Rasterise a sampler into this grid — the write API a `held` potential needs (#443).
    ///
    /// Each cell is filled from `sampler(ix·cell, iy·cell)`, the exact coordinates [`sample`]
    /// interpolates between, so a read at a cell centre returns the sampler's own value.
    ///
    /// **Non-finite is clamped at the boundary, not downstream**: a host sampler returning `NaN` or
    /// infinity writes 0. A non-finite cell would propagate through `sample` into a velocity, and a
    /// NaN velocity slips the `speed > c` guard entirely (every comparison against NaN is false), so
    /// the check belongs here, where the untrusted value enters the engine.
    ///
    /// [`sample`]: ScalarGrid::sample
    pub fn fill_from(&mut self, sampler: impl Fn(f64, f64) -> f64) {
        for iy in 0..self.rows {
            for ix in 0..self.cols {
                let v = sampler(ix as f64 * self.cell, iy as f64 * self.cell);
                self.cur[iy * self.cols + ix] = if v.is_finite() { v } else { 0.0 };
            }
        }
    }

    /// Zero every cell in all three buffers.
    pub fn clear(&mut self) {
        self.cur.fill(0.0);
        self.nxt.fill(0.0);
        self.prev.fill(0.0);
    }

    /// Resize to a new volume, preserving nothing.
    pub fn resize(&mut self, w: f64, h: f64) {
        if w == self.w && h == self.h {
            return;
        }
        self.w = w;
        self.h = h;
        let (cols, rows) = Self::dims(w, h, self.cell);
        self.cols = cols;
        self.rows = rows;
        let n = cols * rows;
        self.cur = vec![0.0; n];
        self.nxt = vec![0.0; n];
        self.prev = vec![0.0; n];
    }
}
