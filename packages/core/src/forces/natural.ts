/**
 * Natural primitives (§20.10) — real field laws, not the designed UI falloffs.
 *
 * The canonical nine (§6) are *designed*: finite range, soft `(1 − d/d_max)ⁿ`
 * falloff, tuned for legible motion on content bodies. These are *natural*: a true
 * softened inverse-square law in the sim unit system (§20.10). `gravity` and
 * `charge` are the **same kernel** — only the source scalar differs (mass ≥ 0 vs.
 * signed charge), which is the one unification the spec says is worth coding once.
 *
 * Opt-in: a body only feels them via `data-body="gravity"` / `data-body="charge"`,
 * so registering them changes nothing on a page that doesn't ask for them.
 */

import type { Body, Particle, Env, Force } from '../core/types.ts';
import type { Registry } from '../core/registry.ts';
import { polePair, dipoleField, EPS, type Pole } from '../core/geometry.ts';

/**
 * The body's dipole field at a world point (the visual/structure field, Stage B): the
 * two-pole superposition scaled by the source magnitude. Shared by `magnetism` (the bar
 * magnet, rendered but not followed) and `charge` (the electric field the force flows
 * along). `s` is the source scalar — `strength` for B, `M` for the charge field.
 *
 * A body with little or no extent (an abstract scenario, a point element) would put both
 * poles at the centre, where the ± contributions cancel to zero. So when the rect-derived
 * separation is negligible, synthesize the dipole along the heading at a fraction of the
 * body's range — every magnetism/charge source then reads as a dipole, regardless of size.
 *
 * Chargeable bodies (field-systems Stage C2): a body's accumulated charge `Q = b.d` (the
 * bounded, eased density the field writes back as `--d` on a `data-feedback` element)
 * sources its field — as the element charges up, it radiates up to `1 + Q_GAIN`× its base
 * field. `b.d` is 0 on point/headless bodies, so the base field is unchanged there.
 */
const Q_GAIN = 1.5;
const DIPOLE_MIN_SEP = 8; // px — below this the rect gives no usable dipole axis
const DIPOLE_MIN_REACH = 60; // px — synthesized pole reach floor (covers range-0 / point bodies)
function bodyDipole(b: Body, x: number, y: number, s: number): { x: number; y: number } {
  let poles = polePair(b);
  const sep = Math.hypot(poles[0].x - poles[1].x, poles[0].y - poles[1].y);
  // synthesize when the rect gives no usable separation. The pixel floors matter for a global
  // body (`data-range="0"`): `range*0.06`/`range*0.18` would be 0, collapsing the dipole to a
  // zero field — the floors keep it a readable dipole regardless of size.
  if (sep < Math.max(b.range * 0.06, DIPOLE_MIN_SEP)) {
    const half = Math.max(b.range * 0.18, DIPOLE_MIN_REACH);
    const sgn = b.spin < 0 ? -1 : 1;
    poles = [
      { x: b.cx + b.ux * half, y: b.cy + b.uy * half, q: sgn },
      { x: b.cx - b.ux * half, y: b.cy - b.uy * half, q: -sgn },
    ] as [Pole, Pole];
  }
  const sq = s * (1 + Q_GAIN * (b.d ?? 0)); // charged elements radiate a stronger field
  const f = dipoleField(poles, x, y);
  return { x: f.x * sq, y: f.y * sq };
}

/**
 * The radial monopole field of a single point charge (the electric field, §20.3): straight
 * field lines out of a positive source, into a negative one — `E = σ·s·r̂/(d²+ε²)`, where `σ`
 * is the body's polarity (`spin`). Unlike a magnet (a dipole — magnetic monopoles do not
 * exist, so `magnetism` loops), a lone electric charge radiates, so `charge` is a monopole.
 */
function bodyMonopole(b: Body, x: number, y: number, s: number): { x: number; y: number } {
  const dx = x - b.cx;
  const dy = y - b.cy;
  const d = Math.max(Math.hypot(dx, dy), EPS);
  const sgn = b.spin < 0 ? -1 : 1;
  const mag = (sgn * s * (1 + Q_GAIN * (b.d ?? 0))) / (d * d); // 1/d², signed by polarity
  return { x: (dx / d) * mag, y: (dy / d) * mag };
}

/**
 * The shared softened inverse-square kernel (§20.10): `s / (d² + ε²)` along the
 * unit vector toward the body, then clamp speed to the unit system's `c` (the
 * hard velocity cap that *is* the speed of light in-sim).
 *
 * Plummer softening `ε = r_s = 2GM/c²` keeps the force finite at the core while
 * staying a true `1/d²` law far out — exactly how N-body sims avoid the singularity.
 * `s` is the signed source strength: `+GM` for gravity (always attractive),
 * `−σ·q·GM` for charge (like repels, opposite attracts).
 *
 * Sign note: this engine's `e.dx/e.dy` point from the particle *toward* the body,
 * so `+s` pulls inward (gravity attracts). Charge negates `σ·q·GM` so that like
 * signs push outward — the §20.3 formula written for an outward-pointing `û`.
 */
export function inverseSquare(b: Body, p: Particle, e: Env, s: number): void {
  if (e.dist >= b.range) return; // practical cutoff radius (an N-body softening too)
  const rs = (2 * e.G * b.M) / (e.c * e.c); // Schwarzschild radius → softening ε (§20.10)
  const f = s / (e.dist * e.dist + rs * rs); // s/(d²+ε²)
  p.vx += (e.dx / e.dist) * f;
  p.vy += (e.dy / e.dist) * f;
  clampToC(p, e.c);
}

/** Clamp a particle's speed to the unit system's `c` — the hard velocity cap that
 *  IS the in-sim speed of light (§20.10). Shared by the natural primitives. */
function clampToC(p: Particle, c: number): void {
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > c) {
    p.vx = (p.vx / sp) * c;
    p.vy = (p.vy / sp) * c;
  }
}

/** §20.10 — true softened inverse-square: `F = GM·d̂/(d²+ε²)`, always attractive. */
export const gravity: Force = {
  token: 'gravity',
  label: 'Gravity',
  apply(b, p, e) {
    inverseSquare(b, p, e, e.G * b.M); // GM, mass-sourced (M ≥ 0 → pulls in)
  },
  meta: { desc: 'true softened inverse-square gravity (a real 1/d² law)' },
};

/** §20.3/§20.10 — the signed sibling of gravity; same kernel, sign sets direction. */
export const charge: Force = {
  token: 'charge',
  label: 'Charge',
  apply(b, p, e) {
    const q = p.charge ?? 0; // neutral matter ignores charge fields
    if (q === 0) return;
    // F = σ·q·GM/(d²+ε²); σ = body sign (data-spin), GM = G·M. Negated for the
    // inward-pointing kernel so like signs repel and opposite signs attract.
    inverseSquare(b, p, e, -(b.spin * q * e.G * b.M));
  },
  // The radial electric field the charge projects (Stage B), sourced by `M` and signed by
  // `spin`: straight field lines, OUT of a + source and IN to a −. A lone charge is a
  // monopole (unlike a magnet's dipole) — the force already flows charged matter along it.
  field: (b, x, y) => bodyMonopole(b, x, y, b.M),
  meta: { desc: 'signed inverse-square — like repels, opposite attracts' },
};

/**
 * §20.10 — the Lorentz force on a moving charge. In 2D the magnetic field `B` is a
 * scalar out of the plane, so the force is perpendicular to velocity: it curves a
 * particle's path into a circle (cyclotron radius `r_L = m|v|/(qB)`) **without doing
 * work** — speed is preserved, only the heading turns. The body's `spin` sets the
 * out-of-plane sense (which way it curls); `strength` is `|B|`. Acts only on charged,
 * *moving* matter; neutral particles pass straight through.
 *
 * `B` is graded by a `(1 − d/r)` falloff, so the curl is strongest at the core and eases
 * to zero at the rim — a localized, soft-edged field rather than a uniform region with a
 * hard cutoff (the field-systems plan, Stage 0). The rotation preserves speed at every
 * distance; only the turn angle shrinks outward.
 */
export const magnetism: Force = {
  token: 'magnetism',
  label: 'Magnetism',
  apply(b, p, e) {
    if (e.dist >= b.range) return; // inside the field region
    const q = p.charge ?? 0;
    if (q === 0) return; // the Lorentz force needs charge
    // Exact rotation by θ = q·spin·B per frame — preserves |v| to floating-point precision.
    // The Euler form (p.vx += -vy*f; p.vy += vx*f) passes the ⟂ test but accumulates
    // speed as sqrt(1+(qB)²)^N, which grows noticeably at strength > 0.1.
    const falloff = 1 - e.dist / b.range; // ∈ (0, 1] inside the region
    const theta = q * b.spin * b.strength * falloff;
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    const vx0 = p.vx;
    p.vx = vx0 * cs - p.vy * sn;
    p.vy = vx0 * sn + p.vy * cs;
  },
  // The dipole structure of B (Stage B). Rendered as field lines; particles curve
  // perpendicular to it (the apply above) rather than following it. Sourced by `strength`.
  field: (b, x, y) => bodyDipole(b, x, y, b.strength),
  meta: { desc: 'Lorentz force — curves a moving charge perpendicular to its velocity' },
};

/**
 * The Langevin noise amplitude `σ = √(2·k_B·T·γ)` (§20.10). In sim units `k_B = γ = 1`,
 * so `σ = √(2T)`; negative `T` is floored to 0 (no imaginary kicks). Pure, so the
 * fluctuation–dissipation law itself is golden-tested apart from the RNG.
 */
export function thermalSigma(T: number): number {
  return Math.sqrt(2 * Math.max(0, T));
}

/**
 * §20.10 — `thermal`: Langevin/Brownian agitation, the *honest* `wander`. Each frame
 * a charge-free Gaussian kick `v += σ·ξ` (ξ ~ N(0,1) per axis) jiggles matter, with
 * `σ = √(2T)`. Paired with `drag` (`−γv`) it's a **thermostat** — fluctuation–
 * dissipation, the swarm equilibrates at temperature `T`. `T` is the body's strength,
 * eased to a localized hot spot by a `(1 − d/d_max)` falloff (sourceable from heat or
 * scroll energy). Box–Muller turns two uniforms into one isotropic 2-D kick.
 */
export const thermal: Force = {
  token: 'thermal',
  label: 'Thermal',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const falloff = 1 - e.dist / b.range; // localized: hotter nearer the source
    const sigma = thermalSigma(b.strength * falloff);
    if (sigma === 0) return;
    // Box–Muller: (u1, u2) → one isotropic N(0,1) pair, scaled by σ.
    const u1 = Math.random() || 1e-9; // avoid log(0)
    const mag = sigma * Math.sqrt(-2 * Math.log(u1));
    const ang = 2 * Math.PI * Math.random();
    p.vx += mag * Math.cos(ang);
    p.vy += mag * Math.sin(ang);
    if (b.on) p.heat = Math.max(p.heat, falloff * 0.4);
    clampToC(p, e.c);
  },
  meta: { desc: 'Langevin/Brownian agitation — a real temperature in the medium' },
};

/**
 * §20.10 — `collide`: elastic pairwise collision (granular / billiard), the hard-sphere
 * complement to the smooth, box-bound `wall`. For each neighbour `q` whose disc
 * overlaps `p`'s (`d < r_p + r_q`, radius ≈ `size`) and that is *approaching*, the pair
 * exchanges normal momentum: `p` takes a half-impulse along the contact normal `n`,
 * `q` the other half on its own turn — so momentum is conserved and, at `e = 1`, energy
 * too. `strength` is the restitution `e ∈ [0,1]`. Class [B] — uses `env.neighbors`.
 */
export const collide: Force = {
  token: 'collide',
  label: 'Collide',
  apply(b, p, e) {
    if (e.dist >= b.range) return; // collisions resolve within the body's region
    const restitution = Math.max(0, Math.min(1, b.strength));
    const pr = Math.max(1, p.size);
    for (const q of e.neighbors(p, pr * 4)) {
      const qr = Math.max(1, q.size);
      const nx = p.x - q.x;
      const ny = p.y - q.y;
      const d = Math.hypot(nx, ny);
      if (d >= pr + qr || d < 1e-6) continue; // not in contact
      const ux = nx / d;
      const uy = ny / d;
      const relN = (p.vx - q.vx) * ux + (p.vy - q.vy) * uy;
      if (relN >= 0) continue; // separating already → no impulse
      // resolve the pair symmetrically in one pass (equal & opposite impulses) so the
      // result is momentum-conserving and order-independent — the integrator processes
      // particles sequentially, so applying only to `p` and trusting `q`'s later turn
      // double-counts (q would read p's already-changed velocity). After this the pair
      // is separating, so q's own apply skips it.
      const j = (1 + restitution) * 0.5 * relN;
      p.vx -= j * ux;
      p.vy -= j * uy;
      q.vx += j * ux;
      q.vy += j * uy;
    }
  },
  meta: { desc: 'elastic pairwise collision — the hard-sphere billiard force' },
};

/**
 * §20.10 — `diffuse` (class [C], over the scalar `grid`): the pheromone/stigmergy
 * field. Each frame a particle lays a mark into the shared `diffuse` grid (which the
 * engine blurs via `∂φ/∂t = D∇²φ`) and steers *up* the local gradient, following the
 * smeared trail toward where matter has gathered. `strength` sets both the deposit and
 * the follow gain. Self-organizing trails emerge from the deposit↔blur↔follow loop.
 */
export const diffuse: Force = {
  token: 'diffuse',
  label: 'Diffuse',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const g = e.grid('diffuse');
    g.deposit(p.x, p.y, b.strength); // lay a mark
    const grad = g.gradient(p.x, p.y); // follow the blurred trail up-gradient
    p.vx += grad.x * b.strength;
    p.vy += grad.y * b.strength;
  },
  meta: { desc: 'pheromone field — deposit a mark and follow the diffused gradient' },
};

/** Frames between emitted shocks while a propagate body is engaged. A *pulse train* — not a
 *  continuous drip — is what keeps it a travelling wave: between pulses the grid radiates and
 *  damps, so no standing bump builds at the source (that bump is what used to pull matter IN). */
const WAVE_PULSE_PERIOD = 12;
/** How hard a passing wavefront carries matter outward (radiation pressure gain). */
const WAVE_PUSH = 7;

/**
 * §20.10 — `propagate` (class [C], over a wave-mode `grid`): a travelling disturbance,
 * `∂²φ/∂t² = c²∇²φ`. An engaged body injects an impulsive shock at its centre (via the
 * body-level `source` hook, once per frame — not once per particle), and the grid carries it
 * outward as a real expanding ring. Matter **rides the front out**: where the wavefront is
 * passing (`|∇φ|` is steep) a particle is pushed radially *away from the source*, so the
 * expanding shock sweeps matter outward with it — radiation pressure, not an inward pull.
 *
 * Why a pulse train, not a continuous deposit: depositing every frame builds a standing φ bump
 * at the centre, whose gradient points inward — `v += ∇φ` then sucks matter toward the source
 * (the opposite of a wave). Emitting a shock every `WAVE_PULSE_PERIOD` frames lets each ring
 * radiate and damp away, so the field stays a sequence of outgoing fronts.
 */
export const propagate: Force = {
  token: 'propagate',
  label: 'Propagate',
  source(b, e) {
    if (!b.on) return; // only an engaged body emits
    if (e.frameN % WAVE_PULSE_PERIOD !== 0) return; // a shock train, once per period (body-level)
    e.grid('wave-propagate').deposit(b.cx, b.cy, b.strength); // 'wave…' name → wave stepping
  },
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const g = e.grid('wave-propagate');
    const grad = g.gradient(p.x, p.y);
    const act = Math.hypot(grad.x, grad.y); // wavefront activity — steep where a front is passing
    if (act < 1e-6) return; // no front here → coast (the wave has moved on or not yet arrived)
    // ride the front: pushed radially OUTWARD (e.dx/e.dy point toward the body, so negate).
    const ux = -e.dx / e.dist;
    const uy = -e.dy / e.dist;
    p.vx += ux * act * b.strength * WAVE_PUSH;
    p.vy += uy * act * b.strength * WAVE_PUSH;
    clampToC(p, e.c);
  },
  meta: { desc: 'a travelling wave — a shock train expands from the source, sweeping matter out' },
};

/**
 * Memory (class [C], over a slow-decaying `memory` grid) — the field remembers.
 * Each frame a particle lays occupancy where it sits, into a grid that barely blurs
 * and fades slowly; the body's pull is then amplified by how worn the spot is. So
 * `M(x) += λ` and the effective force `×= (1 + μ·M)`: frequently-travelled routes
 * deepen and pull harder, and channels wear in over time.
 */
export const memory: Force = {
  token: 'memory',
  label: 'Memory',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const g = e.grid('memory'); // 'memory' name → slow-decay stepping
    g.deposit(p.x, p.y, b.strength * 0.15); // wear the path where matter sits
    const amp = 1 + 0.5 * g.sample(p.x, p.y); // worn paths pull harder (1 + μ·M)
    const f = (1 - e.dist / b.range) ** 2 * b.strength * 0.5 * amp;
    p.vx += (e.dx / e.dist) * f;
    p.vy += (e.dy / e.dist) * f;
  },
  meta: { desc: 'the field remembers — occupancy wears in paths that pull harder' },
};

/** The natural primitives, in spec order (§20.10). */
export const naturalForces: readonly Force[] = [
  gravity,
  charge,
  magnetism,
  thermal,
  collide,
  diffuse,
  propagate,
  memory,
];

/** Register the natural primitives on a registry (§4) — opt-in, alongside the nine. */
export function registerNaturalForces(reg: Registry): void {
  for (const f of naturalForces) reg.force(f);
}
