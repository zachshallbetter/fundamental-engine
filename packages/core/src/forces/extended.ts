/**
 * Designed extended forces (§20.3, implementation class [A]).
 *
 * Like the canonical nine (§6) these are *designed* — finite range, soft falloff,
 * tuned for legibility — but they live outside the core nine as opt-in enrichments.
 * Class [A] means each acts on a single particle from the shared per-frame `env`,
 * needing no neighbour or grid services, so they register and test exactly like the
 * nine. Opt-in via `data-body="lens"` etc.; a page that doesn't ask is unaffected.
 */

import type { Force, Particle } from '../core/types.ts';
import type { Registry } from '../core/registry.ts';
import { mixHex } from '../core/math.ts';

/**
 * §20.3 — `lens`: rotate the velocity, preserving its magnitude. A gravitational
 * lens bends a path without adding energy, so this is a pure rotation by an angle
 * that grows as a particle nears the body: `θ = θ_max·(1 − d/d_max)·sign`, then
 * `v ← rotate(v, θ)`. `strength` is θ_max (radians), `spin` the sign of the bend.
 */
export const lens: Force = {
  token: 'lens',
  label: 'Lens',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const theta = b.strength * (1 - e.dist / b.range) * b.spin;
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    const vx = p.vx;
    const vy = p.vy;
    p.vx = vx * cs - vy * sn; // rotate(v, θ) — speed is conserved exactly
    p.vy = vx * sn + vy * cs;
  },
  meta: { desc: 'rotates velocity, preserving speed — bends paths without adding energy' },
};

/**
 * §20.3 — `gate`: a one-way membrane. Along its heading `n = (cosθ, sinθ)` matter
 * passes freely; matter crossing the *wrong* way (`v·n < 0`) is reflected across the
 * membrane, `v −= 2(v·n)·n`, so its normal component flips to travel with `n`. Sized
 * by the element box (like `reflect`, §6.4); `data-angle` sets `n`.
 */
export const gate: Force = {
  token: 'gate',
  label: 'Gate',
  apply(b, p, e) {
    const pad = 6; // act on matter within the element box (the membrane's extent)
    if (Math.abs(p.x - b.cx) >= b.hw + pad || Math.abs(p.y - b.cy) >= b.hh + pad) return;
    const vn = p.vx * b.ux + p.vy * b.uy; // velocity along the heading n
    if (vn < 0) {
      p.vx -= 2 * vn * b.ux; // reflect the wrong-way crosser back through n
      p.vy -= 2 * vn * b.uy;
    }
  },
  meta: { desc: 'a one-way membrane — passes matter along its heading, reflects the reverse' },
};

/**
 * §20.3 — `buoyancy`: a constant lift/sink set by a density difference. A particle's
 * density `ρ_p = base / (size · (1 + heat))` falls as it grows or heats, so hot/large
 * matter is lighter than the medium and rises while denser matter settles
 * (sedimentation). `strength` is `g`; `data-range = 0` makes it global. Both `base`
 * and the medium density are 1, so a unit-size, cool particle is neutrally buoyant.
 *
 * The spec writes `v_y += (ρ_med − ρ_p)·g`; the engine's `+y` points *down*, so we
 * apply that quantity as a lift (subtract from `v_y`) — lighter matter rises (`−y`),
 * denser sinks (`+y`).
 */
const BUOY_BASE = 1;
const BUOY_MEDIUM = 1;
export const buoyancy: Force = {
  token: 'buoyancy',
  label: 'Buoyancy',
  apply(b, p, e) {
    if (b.range > 0 && e.dist >= b.range) return; // range 0 ⇒ global field
    const rhoP = BUOY_BASE / (p.size * (1 + p.heat)); // hotter / bigger → lighter
    p.vy -= (BUOY_MEDIUM - rhoP) * b.strength; // lift up (−y) when lighter than the medium
  },
  meta: { desc: 'a constant lift/sink by density difference — light matter rises, dense settles' },
};

/**
 * §20.3 — `shear`: a laminar velocity gradient (Couette flow). Speed along the flow
 * axis `n = (cosθ, sinθ)` grows with a particle's *perpendicular* offset from the
 * body: `v_∥ += S·(offset_⊥/d_max)·(1 − d/d_max)`. Matter on one side of the axis is
 * dragged forward, the other side back — laminae sliding past each other.
 * `data-angle` sets the flow axis; `strength` is S.
 */
export const shear: Force = {
  token: 'shear',
  label: 'Shear',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    // perpendicular axis is (−uy, ux); offset_⊥ = (p − centre) · perp
    const offsetPerp = (p.x - b.cx) * -b.uy + (p.y - b.cy) * b.ux;
    const f = b.strength * (offsetPerp / b.range) * (1 - e.dist / b.range);
    p.vx += b.ux * f; // accelerate along the flow axis n
    p.vy += b.uy * f;
  },
  meta: { desc: 'a laminar shear gradient — flow speed grows with perpendicular offset' },
};

/**
 * §20.3 — `crystallize`: a phase change. While a particle is cool (`heat < FREEZE`)
 * it snaps toward the nearest node of a lattice anchored at the body, `v += (node −
 * p)·k_snap`, then damps (`v *= 0.9`) so it settles into a solid; once hot it melts
 * and moves freely. `strength` is `k_snap`; pairs naturally with `data-when="cool"`.
 */
const LATTICE = 32; // lattice cell, px
const FREEZE = 0.5; // heat below which matter solidifies
export const crystallize: Force = {
  token: 'crystallize',
  label: 'Crystallize',
  apply(b, p, e) {
    if (e.dist >= b.range || p.heat >= FREEZE) return; // out of range or melted → free
    const nodeX = b.cx + Math.round((p.x - b.cx) / LATTICE) * LATTICE;
    const nodeY = b.cy + Math.round((p.y - b.cy) / LATTICE) * LATTICE;
    p.vx += (nodeX - p.x) * b.strength; // pull toward the lattice node
    p.vy += (nodeY - p.y) * b.strength;
    p.vx *= 0.9; // damp → settle into the solid
    p.vy *= 0.9;
  },
  meta: { desc: 'snaps cool matter onto a lattice; melts and frees it when hot' },
};

/**
 * §20.3 — `align`: steer velocity toward a target heading `ĥ` while preserving speed,
 * `v += (ĥ·|v| − v)·k_align`. Unifies both spec variants: `[B]` uses the **mean of
 * neighbours' headings** when `p` has any (boids alignment), and falls back to `[A]`,
 * the body's own `data-angle` heading, when it's alone. `strength` is `k_align`.
 */
export const align: Force = {
  token: 'align',
  label: 'Align',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const speed = Math.hypot(p.vx, p.vy); // steer toward ĥ·|v| → turns without speeding up
    const k = b.strength;
    let hx = b.ux; // [A] default: the body heading
    let hy = b.uy;
    let sx = 0;
    let sy = 0;
    for (const n of e.neighbors(p, b.range)) {
      const ns = Math.hypot(n.vx, n.vy); // sum the neighbours' unit velocities (v̂)
      if (ns > 1e-6) {
        sx += n.vx / ns;
        sy += n.vy / ns;
      }
    }
    const sm = Math.hypot(sx, sy);
    if (sm > 1e-6) {
      hx = sx / sm; // [B]: the mean neighbour heading
      hy = sy / sm;
    }
    p.vx += (hx * speed - p.vx) * k;
    p.vy += (hy * speed - p.vy) * k;
  },
  meta: { desc: 'steers toward the neighbour-mean heading (or the body heading when alone)' },
};

/**
 * A smooth divergence-free flow field (§20.3) — the curl of a sinusoidal stream-
 * function `ψ = sin(a)·cos(b)`, with `a = x·s + 0.2t`, `b = y·s − 0.2t`. The velocity
 * `(∂ψ/∂y, −∂ψ/∂x)` is divergence-free by construction (`∇·curl ≡ 0`), so it stirs
 * without compressing. Closed-form (no RNG) → deterministic and exactly testable.
 * `s` is the spatial scale of the eddies.
 */
export function curlNoise(x: number, y: number, t: number, s: number): { x: number; y: number } {
  const a = x * s + t * 0.2;
  const b = y * s - t * 0.2;
  // ∂ψ/∂x = s·cos(a)cos(b), ∂ψ/∂y = −s·sin(a)sin(b); curl = (∂ψ/∂y, −∂ψ/∂x)
  return { x: -s * Math.sin(a) * Math.sin(b), y: -s * Math.cos(a) * Math.cos(b) };
}

/**
 * §20.3 — `wind`: divergence-free turbulence, `v += curl(noise(x·s, y·s, t))·S`.
 * `strength` is the amplitude S; `data-range = 0` makes it a global gust. (The
 * spatial scale is a fixed constant for now — wiring `data-scale` would need a new
 * Body field.)
 */
const WIND_SCALE = 0.01;
export const wind: Force = {
  token: 'wind',
  label: 'Wind',
  apply(b, p, e) {
    if (b.range > 0 && e.dist >= b.range) return; // range 0 ⇒ global
    const c = curlNoise(p.x, p.y, e.t, WIND_SCALE);
    p.vx += c.x * b.strength;
    p.vy += c.y * b.strength;
  },
  meta: { desc: 'divergence-free curl-noise turbulence' },
};

/**
 * §20.3 — `cohesion` (class [B], over `env.neighbors`): short-range pressure + mid-range
 * pull, i.e. surface tension. Around a rest distance `r₀` each neighbour pushes `p` away
 * when closer than `r₀` and draws it in when between `r₀` and the neighbour radius `r₁`.
 * The spec's raw `k·(r₀ − d)` is normalized to a unit interval here so velocities stay
 * UI-sane over ~100px distances. `strength` is the stiffness; `r₀ = r₁·0.5` (a fraction
 * of the range, since `data-r0` would need a new Body field); `range` is `r₁`.
 */
const COHESION_REST = 0.5; // r₀ as a fraction of r₁
export const cohesion: Force = {
  token: 'cohesion',
  label: 'Cohesion',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const r1 = b.range;
    const r0 = r1 * COHESION_REST;
    const k = b.strength;
    for (const n of e.neighbors(p, r1)) {
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const dn = Math.hypot(dx, dy);
      if (dn < 1e-6) continue;
      const ux = dx / dn;
      const uy = dy / dn;
      if (dn < r0) {
        const f = (k * (r0 - dn)) / r0; // pressure: push apart (no overlap)
        p.vx -= f * ux;
        p.vy -= f * uy;
      } else {
        const f = (k * (dn - r0)) / (r1 - r0); // cohesion: pull toward the skin
        p.vx += f * ux;
        p.vy += f * uy;
      }
    }
  },
  meta: { desc: 'short-range pressure + mid-range cohesion — surface tension over neighbours' },
};

/**
 * §20.3 — `pressure` (class [B], over `env.neighbors`): SPH-style density relaxation
 * → an incompressible even-fill. Each particle estimates the local matter density by
 * summing a smooth kernel `W(d, h) = (1 − d/h)²` over its neighbours, then pushes *down*
 * the density gradient whenever it sits above a rest density `ρ₀` — so crowded matter
 * spreads out and settles to an even spacing instead of overlapping. Unlike `cohesion`
 * (which has a mid-range *pull*), pressure only ever pushes apart; the rest density sets
 * the equilibrium spacing. Momentum-conserving for a symmetric pair (each member pushes
 * the other equally and oppositely). `range` is the smoothing radius `h`; `strength` is
 * the stiffness `k`; `ρ₀` is a fixed fraction (a new `data-rho0` would need a Body field).
 */
const PRESSURE_REST = 0.5; // ρ₀ — the rest density that sets the equilibrium spacing
export const pressure: Force = {
  token: 'pressure',
  label: 'Pressure',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const h = b.range;
    const k = b.strength;
    // first pass: local density ρ_p = Σ W(d, h), W = (1 − d/h)²  (a smooth, cheap kernel)
    let rho = 0;
    const ns = e.neighbors(p, h);
    for (const n of ns) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < h) rho += (1 - d / h) ** 2;
    }
    const over = rho - PRESSURE_REST; // pressure scalar P = k·(ρ − ρ₀)
    if (over <= 0) return; // under-dense → no push (an even fill only relaxes crowding)
    // second pass: push away from each neighbour along the (spiky) density gradient,
    // weighted by how crowded the spot is — strongest at close range (no overlap).
    for (const n of ns) {
      const dx = p.x - n.x; // neighbour → p, i.e. the away-from-crowd direction
      const dy = p.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6 || d >= h) continue;
      const f = (k * over * (1 - d / h)) / d; // ∝ P · ∇W, normalized by d to use (dx, dy)
      p.vx += f * dx;
      p.vy += f * dy;
    }
  },
  meta: { desc: 'SPH density relaxation — incompressible even-fill via mutual repulsion' },
};

/**
 * §20.3 — `hunt` (class [B], over `env.neighbors`): a two-species pursuit. A particle's
 * `species` sets its role: predators (species `0`) accelerate toward the nearest particle
 * of another species; prey (species ≠ `0`) accelerate directly away from the nearest
 * predator. `range` is the perception radius; `strength` the seek/flee gain. So a field of
 * two species chases and scatters — schooling/fleeing motion. The Lotka–Volterra
 * *population* cycle (births and deaths) is an emergent simulation concern, not this
 * per-particle motion law; `hunt` is the chase itself, honestly.
 */
export const hunt: Force = {
  token: 'hunt',
  label: 'Hunt',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const me = p.species ?? 0;
    // the nearest neighbour of a *different* species — the target to chase or escape
    let target: Particle | null = null;
    let bestD2 = Infinity;
    for (const n of e.neighbors(p, b.range)) {
      if ((n.species ?? 0) === me) continue;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        target = n;
      }
    }
    if (!target) return; // nothing of the other species in reach
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = me === 0 ? 1 : -1; // predator seeks (toward), prey flees (away)
    p.vx += (dx / d) * b.strength * dir;
    p.vy += (dy / d) * b.strength * dir;
  },
  meta: { desc: 'two-species pursuit — predators seek prey, prey flee predators' },
};

/**
 * §20.3 — `resonate`: a *modifier* that pulses its sibling forces. It contributes no
 * force of its own; instead `modify` returns a time-varying strength multiplier
 * `1 + sin(ω·t)` (the spec's `S(t) = S₀·(1 + sin(ωt + φ))`), so e.g. `resonate attract`
 * is a well that breathes. `spin` tunes the rate (`data-omega` not yet a Body field).
 */
const RESONATE_OMEGA = 3;
export const resonate: Force = {
  token: 'resonate',
  label: 'Resonate',
  apply() {}, // pure modifier — the work is in modify()
  modify(b, _p, e) {
    return { strength: 1 + Math.sin(e.t * RESONATE_OMEGA * b.spin) };
  },
  meta: { desc: 'pulses sibling forces with a time-varying strength S(t)=S₀(1+sin ωt)' },
};

/**
 * §20.3 — `spotlight`: a *modifier* that gates its sibling forces to an angular cone of
 * the heading `(ux, uy)`. A particle outside the cone is skipped for *every* token on
 * the body this frame; inside, the siblings act normally — so `spotlight stream` is a
 * directed beam. Cone half-angle is fixed (~60°; `data-fov` not yet a Body field).
 */
const SPOTLIGHT_COS = 0.5;
export const spotlight: Force = {
  token: 'spotlight',
  label: 'Spotlight',
  apply() {}, // pure modifier — the work is in modify()
  modify(b, _p, e) {
    const dirx = -e.dx / e.dist; // body → particle (e.dx points particle → body)
    const diry = -e.dy / e.dist;
    return { gate: dirx * b.ux + diry * b.uy < SPOTLIGHT_COS };
  },
  meta: { desc: 'gates sibling forces to an angular cone of the heading' },
};

/**
 * §20.8 — `pigment` (class [E], particle attribute `color`): conserved colour
 * transport. A particle that overlaps a pigment body takes on the body's tint
 * (`data-color`) and carries it away — the section *stains* the field, and the
 * colour advects with the matter instead of being re-tinted globally. Opt-in and
 * inert without a tint, so a normal field is untouched.
 */
export const pigment: Force = {
  token: 'pigment',
  label: 'Pigment',
  apply(b, p, e) {
    const tint = b.tint;
    if (!tint || e.dist >= b.range * 0.6) return; // only stains on overlap
    p.color = p.color ? mixHex(p.color, tint, 0.08) : tint; // adopt, then advect toward
  },
  meta: { desc: 'conserved colour transport — matter takes on and carries a tint' },
};

/** The designed extended forces, in spec order (§20.3). */
export const extendedForces: readonly Force[] = [
  lens,
  gate,
  buoyancy,
  shear,
  crystallize,
  align,
  wind,
  cohesion,
  pressure,
  hunt,
  resonate,
  spotlight,
  pigment,
];

/** Register the designed extended forces on a registry (§4) — opt-in, alongside the nine. */
export function registerExtendedForces(reg: Registry): void {
  for (const f of extendedForces) reg.force(f);
}
