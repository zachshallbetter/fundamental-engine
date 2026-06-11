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
  kinematic: true, // a pure rotation of velocity — bends the path, not the speed, mass-free
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
 * by the element box (like `wall`, §6.4); `data-angle` sets `n`.
 */
export const gate: Force = {
  token: 'gate',
  label: 'Gate',
  kinematic: true, // reflects wrong-way crossers — a constraint, not an acceleration
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
    const pvz = p.vz ?? 0;
    const speed = Math.hypot(p.vx, p.vy, pvz); // steer toward ĥ·|v| → turns without speeding up
    const k = b.strength;
    let hx = b.ux; // [A] default: the body heading (planar — data-angle is in-plane)
    let hy = b.uy;
    let hz = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const n of e.neighbors(p, b.range)) {
      const nvz = n.vz ?? 0;
      const ns = Math.hypot(n.vx, n.vy, nvz); // sum the neighbours' unit velocities (v̂)
      if (ns > 1e-6) {
        sx += n.vx / ns;
        sy += n.vy / ns;
        sz += nvz / ns;
      }
    }
    const sm = Math.hypot(sx, sy, sz);
    if (sm > 1e-6) {
      hx = sx / sm; // [B]: the mean neighbour heading
      hy = sy / sm;
      hz = sz / sm;
    }
    p.vx += (hx * speed - p.vx) * k;
    p.vy += (hy * speed - p.vy) * k;
    if (hz || pvz) p.vz = pvz + (hz * speed - pvz) * k;
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
      const dzn = (n.z ?? 0) - (p.z ?? 0); // 3D separation in a volume (z-axis.md)
      const dn = Math.hypot(dx, dy, dzn);
      if (dn < 1e-6) continue;
      const ux = dx / dn;
      const uy = dy / dn;
      const uz = dzn / dn;
      if (dn < r0) {
        const f = (k * (r0 - dn)) / r0; // pressure: push apart (no overlap)
        p.vx -= f * ux;
        p.vy -= f * uy;
        if (dzn) p.vz = (p.vz ?? 0) - f * uz;
      } else {
        const f = (k * (dn - r0)) / (r1 - r0); // cohesion: pull toward the skin
        p.vx += f * ux;
        p.vy += f * uy;
        if (dzn) p.vz = (p.vz ?? 0) + f * uz;
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
      const d = Math.hypot(n.x - p.x, n.y - p.y, (n.z ?? 0) - (p.z ?? 0));
      if (d < h) rho += (1 - d / h) ** 2;
    }
    const over = rho - PRESSURE_REST; // pressure scalar P = k·(ρ − ρ₀)
    if (over <= 0) return; // under-dense → no push (an even fill only relaxes crowding)
    // second pass: push away from each neighbour along the (spiky) density gradient,
    // weighted by how crowded the spot is — strongest at close range (no overlap).
    for (const n of ns) {
      const dx = p.x - n.x; // neighbour → p, i.e. the away-from-crowd direction
      const dy = p.y - n.y;
      const dzn = (p.z ?? 0) - (n.z ?? 0);
      const d = Math.hypot(dx, dy, dzn);
      if (d < 1e-6 || d >= h) continue;
      const f = (k * over * (1 - d / h)) / d; // ∝ P · ∇W, normalized by d to use the deltas
      p.vx += f * dx;
      p.vy += f * dy;
      if (dzn) p.vz = (p.vz ?? 0) + f * dzn;
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
      const dzn = (n.z ?? 0) - (p.z ?? 0);
      const d2 = dx * dx + dy * dy + dzn * dzn;
      if (d2 < bestD2) {
        bestD2 = d2;
        target = n;
      }
    }
    if (!target) return; // nothing of the other species in reach
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dzn = (target.z ?? 0) - (p.z ?? 0);
    const d = Math.hypot(dx, dy, dzn) || 1;
    const dir = me === 0 ? 1 : -1; // predator seeks (toward), prey flees (away)
    p.vx += (dx / d) * b.strength * dir;
    p.vy += (dy / d) * b.strength * dir;
    if (dzn) p.vz = (p.vz ?? 0) + (dzn / d) * b.strength * dir;
  },
  meta: { desc: 'two-species pursuit — predators seek prey, prey flee predators' },
};

/**
 * §20.3 — `link` (class [B], over `env.neighbors`): a Verlet distance constraint that
 * holds matter at a rest length, so a dense blob behaves as rope / chain / cloth — a soft
 * structure rather than a gas. The spec declares explicit pairs (`data-link="a b"`), but
 * this engine's particles are an anonymous pool, so `link` bonds to *every* neighbour
 * inside a bond radius (`range`) and pulls each toward the rest length `L = range·0.35`:
 * too far → pull in, too close → push out, stiffness `k = strength`. Each particle applies
 * only *half* the correction toward each partner; the partner applies its half on its own
 * turn, so the pair satisfies the constraint symmetrically and momentum is conserved.
 */
const LINK_REST = 0.35; // rest length L as a fraction of the bond radius (range)
export const link: Force = {
  token: 'link',
  label: 'Link',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const r = b.range;
    const L = r * LINK_REST;
    const k = b.strength;
    for (const n of e.neighbors(p, r)) {
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const dzn = (n.z ?? 0) - (p.z ?? 0); // 3D bond length in a volume (z-axis.md)
      const d = Math.hypot(dx, dy, dzn);
      if (d < 1e-6) continue;
      const err = d - L; // +ve → too far (pull together); −ve → too close (push apart)
      const f = 0.5 * k * (err / L); // half the Verlet correction; the partner does its half
      p.vx += f * (dx / d);
      p.vy += f * (dy / d);
      if (dzn) p.vz = (p.vz ?? 0) + f * (dzn / d);
    }
  },
  meta: { desc: 'a Verlet distance constraint — holds a rest length, so matter ropes and drapes' },
};

/**
 * §20.3 — `morph` (class [D]): matter assembles into a shape. Each particle is assigned
 * a stable target point from the body's `targets` set (hashed from its fixed scatter
 * fraction `gx`, so the assignment never flickers frame to frame), springs toward it, and
 * the random jitter fades as it arrives — so the swarm settles into the form. `strength`
 * is the spring gain.
 *
 * **DESIGN LAW (§11):** targets are *marks* — a logo, an icon, a chart, a map,
 * punctuation — **never words or letterforms**. Text is rendered as text and made to
 * react (glow/grow via `--d`, §8); particles never spell. The `targets` set must come
 * from a non-word source.
 *
 * **Reach:** like every ranged body, the engine only applies morph to matter within ~1.6×
 * the body's `range` of its centre (the integrator's cull radius). So `range` is morph's
 * *recruitment radius* — distant matter is not pulled into the form. To assemble from the
 * whole field, give the body a large range, or `data-range="0"` (global, never culled).
 */
const MORPH_ARRIVE = 40; // px within which a particle counts as "arrived" (jitter fades)
export const morph: Force = {
  token: 'morph',
  label: 'Morph',
  apply(b, p, e) {
    const ts = b.targets;
    if (!ts || ts.length === 0) return; // no shape assigned → inert
    // stable assignment: hash the particle's fixed scatter fraction to a target index, so
    // a given particle always aims at the same point (no flicker as the pool reorders).
    const i = Math.min(ts.length - 1, Math.floor((p.gx ?? 0) * ts.length));
    const t = ts[i]!;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    const k = b.strength;
    p.vx += dx * k * 0.02; // spring toward the target point
    p.vy += dy * k * 0.02;
    // targets are marks on the page plane (z-axis.md): the same spring returns matter to z = 0.
    if (p.z) p.vz = (p.vz ?? 0) - p.z * k * 0.02;
    const arrived = d < MORPH_ARRIVE ? 1 - d / MORPH_ARRIVE : 0;
    const jit = (1 - arrived) * k * 0.3; // jitter that fades to zero on arrival
    if (jit > 0) {
      p.vx += (Math.random() - 0.5) * jit;
      p.vy += (Math.random() - 0.5) * jit;
    }
  },
  meta: { desc: 'matter assembles into a mark/chart/logo — never words (§11)' },
};

/**
 * §20.1/§20.2 — `spawn` (class [S], the source *atom*): the one force that *creates*
 * matter rather than moving it. While its body is engaged it emits particles each frame
 * at the body centre, launched along the heading `(ux, uy)` within a soft cone. This
 * deliberately breaks conservation (§2.4), so every spawned particle is **mortal**: it
 * carries a finite `age` and despawns when it expires (the integrator's [S] sink), and
 * the engine caps the pool besides — a budgeted source, per the §20.1 conservation note.
 * `strength` sets the emission rate; `angle` the direction. `fountain` is the preset that
 * names a continuous upward spawn; `supernova` is its one-shot cousin (the conserved
 * absorb→release event is the everyday path — reach for [S] only when creation is the
 * point). A pure source: `apply` is a no-op, the work is in `source()`.
 */
export const SPAWN_LIFE = 90; // default lifespan (frames) when the body declares no data-life
export const spawn: Force = {
  token: 'spawn',
  label: 'Spawn',
  apply() {}, // a source, not a per-particle force — the work is in source()
  source(b, e) {
    // emit continuously (a fountain flows while on-screen); the integrator's source pass
    // already skips non-visible bodies, so an off-screen source is silent.
    //
    // The source budget (workover v0.3 §"Source and sink rules"): each emission carries the
    // body's `data-life` (default 90 frames), and `data-cap` clamps the emission rate to
    // `cap / life` per frame — so the body's live spawned population is bounded at ~cap,
    // independent of the engine's pool ceiling. A fractional rate accumulates on the body
    // (b.emitAcc) so sub-1/frame budgets still flow.
    const life = b.life ?? SPAWN_LIFE;
    let rate = Math.max(1, Math.round(b.strength * 2)); // particles per frame
    if (b.cap != null && b.cap > 0 && life > 0) rate = Math.min(rate, b.cap / life);
    b.emitAcc = (b.emitAcc ?? 0) + rate;
    let n = Math.floor(b.emitAcc);
    b.emitAcc -= n;
    for (; n > 0; n--) {
      // rotate the heading by a small random angle → a soft emission cone
      const j = (Math.random() - 0.5) * 0.6;
      const c = Math.cos(j);
      const s = Math.sin(j);
      const hx = b.ux * c - b.uy * s;
      const hy = b.ux * s + b.uy * c;
      const speed = 2 + Math.random() * 2;
      e.spawn({ x: b.cx, y: b.cy, vx: hx * speed, vy: hy * speed, age: life, heat: 0.6 });
    }
  },
  meta: { desc: 'a source — emits matter along the heading, budgeted by a lifespan' },
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
 * Workover v0.3 — `screen`: a quiet zone / shield (truth mode: designed). A body carrying
 * `screen` damps the magnitude of OTHER bodies' forces on matter inside its `data-range`,
 * by `screenFactor` (`core/math.ts`) — text shielded from a noisy field, a calm pocket in a
 * busy page.
 * Cross-body by definition, so the work happens in the integrator's force pass (the only
 * place per-particle, per-body forces compose); this module is the registered token, the
 * passported identity, and the pure math. `apply` is a no-op — like `spotlight`/`resonate`
 * it is a modifier, but one that modifies its *neighbors*, not its own siblings. Initial
 * mode is `local` (the only shipped mode; `data-screen-mode` inside/outside/behind are
 * future work). Probe-style diagnostic samplers (`forceAt`, the Lab's frame-0 delta) read
 * raw forces and do not apply screen attenuation — the integrator is the contract.
 */
export const screen: Force = {
  token: 'screen',
  label: 'Screen',
  apply() {}, // a cross-body modifier — the attenuation lives in the integrator's force pass
  meta: { desc: "a quiet zone — attenuates other bodies' forces on matter inside its radius" },
};

/**
 * §20.8 — `pigment` (class [E], particle attribute `color`): conserved color
 * transport. A particle that overlaps a pigment body takes on the body's tint
 * (`data-color`) and carries it away — the section *stains* the field, and the
 * color advects with the matter instead of being re-tinted globally. Opt-in and
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
  meta: { desc: 'conserved color transport — matter takes on and carries a tint' },
};

/**
 * §20.3 — `fieldflow`: follow the field lines. Where `magnetism` curls a moving charge
 * *across* the field (the perpendicular Lorentz force, no work) and `charge` pushes only
 * *charged* matter along its own radial field, `fieldflow` advects ALL matter ALONG the net
 * structure field every body radiates — the superposition of every `field()` hook, read
 * through `env.fieldAt`. It both **steers** velocity onto the local field line (speed-
 * preserving, like `align`) and **accelerates** matter down it (does work), so a swarm
 * threads the dipole loops of a magnet or streams off a charge like plasma along a solar
 * prominence. The line *direction* is used scale-free (normalized), so a weak dipole channels
 * matter as surely as a strong monopole — the look no longer depends on the field's absolute
 * magnitude. Because it follows the *net* field (not just this body's), matter routes along
 * the lines that link two poles, so the channelling *between* bodies emerges from the geometry.
 * `strength` is the gain; the `(1 − d/r)` falloff localizes it (range 0 ⇒ a global field-follow,
 * the `magnetic` formation). Acts on neutral matter too — it is field transport of the medium,
 * not the charge-gated Lorentz force.
 */
const FIELDFLOW_STEER = 0.5; // fraction of velocity turned onto the line per frame (× gain)
const FIELDFLOW_ACCEL = 0.12; // streaming acceleration along the line (× gain)
export const fieldflow: Force = {
  token: 'fieldflow',
  label: 'Field Flow',
  apply(b, p, e) {
    if (b.range > 0 && e.dist >= b.range) return; // range 0 ⇒ global
    const F = e.fieldAt?.(p.x, p.y); // the net field every body's field() radiates here
    if (!F) return;
    const mag = Math.hypot(F.x, F.y);
    if (!(mag > 1e-9)) return; // a true null point (or NaN) — no line to follow
    const ux = F.x / mag; // the field-line tangent (direction only — scale-free, so a faint
    const uy = F.y / mag; // dipole reads as clearly as a strong monopole)
    const falloff = b.range > 0 ? 1 - e.dist / b.range : 1;
    const gain = b.strength * falloff;
    // 1) STEER onto the line — turn velocity toward the tangent without spending it (like `align`).
    // The structure field is planar (bodies radiate in the page plane), so the steer also
    // turns any z velocity onto the in-plane line — matter funnels back toward the plane.
    const pvz = p.vz ?? 0;
    const sp = Math.hypot(p.vx, p.vy, pvz);
    if (sp > 1e-6) {
      const k = Math.min(1, gain * FIELDFLOW_STEER);
      p.vx += (ux * sp - p.vx) * k;
      p.vy += (uy * sp - p.vy) * k;
      if (pvz) p.vz = pvz + (0 - pvz) * k; // the line's z tangent is 0
    }
    // 2) STREAM down the line — accelerate along it (the flare ejection; does work).
    p.vx += ux * gain * FIELDFLOW_ACCEL;
    p.vy += uy * gain * FIELDFLOW_ACCEL;
    // bound by the unit system's speed of light (§20.10), as gravity/thermal do.
    const vz2 = p.vz ?? 0;
    const s2 = p.vx * p.vx + p.vy * p.vy + vz2 * vz2;
    if (s2 > e.c * e.c) {
      const inv = e.c / Math.sqrt(s2);
      p.vx *= inv;
      p.vy *= inv;
      if (vz2) p.vz = vz2 * inv;
    }
    if (b.on) p.heat = Math.max(p.heat, falloff * 0.4);
  },
  meta: { desc: 'follow the field lines — steer onto and stream down the net field a body radiates' },
};

/** The designed extended forces, in spec order (§20.3). */
/**
 * §22.3 — `warp`: a wormhole throat. Matter that enters the throat (within `absorbR`) is
 * *relocated* — conserved, not created or destroyed — to the paired body's throat, emerging just
 * outside it moving outward, with its local offset and velocity rotated by `data-twist` and scaled by
 * `data-scale`. The pairing (`data-pair="#other"`) and the live target centre are resolved by the
 * engine into `b.warpHas` / `b.warpX` / `b.warpY`; the force no-ops with no resolved target. Marked
 * `kinematic` so it sets position/velocity outright (a teleport), unscaled by inertia.
 */
export const warp: Force = {
  token: 'warp',
  label: 'Warp',
  kinematic: true,
  apply(b, p, e) {
    if (!b.warpHas || p.cap) return;
    const throat = b.absorbR;
    if (e.dist >= throat) return;
    const cs = Math.cos(b.twist ?? 0);
    const sn = Math.sin(b.twist ?? 0);
    const k = b.warpScale ?? 1;
    // entry direction (unit local offset from this throat, e.dx/e.dy point *toward* the body), twisted
    const ux = -e.dx / e.dist;
    const uy = -e.dy / e.dist;
    const rux = ux * cs - uy * sn;
    const ruy = ux * sn + uy * cs;
    // emerge just outside the paired throat so it does not immediately re-enter (no ping-pong)
    const outR = throat * k + 6;
    p.x = b.warpX! + rux * outR;
    p.y = b.warpY! + ruy * outR;
    // the paired throat sits on the page plane: the z offset passes through unscaled
    // (the twist is about the z axis, so z is its rotation invariant).
    if (p.z) p.z = (-e.dz! / e.dist) * outR;
    // carry momentum through, rotated by the same twist (speed conserved; vz invariant)
    const vx = p.vx;
    const vy = p.vy;
    p.vx = vx * cs - vy * sn;
    p.vy = vx * sn + vy * cs;
    p.heat = Math.max(p.heat, 0.6);
  },
  meta: { desc: 'a wormhole throat — relocates matter to its paired body, conserved' },
};

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
  link,
  hunt,
  morph,
  spawn,
  resonate,
  spotlight,
  screen,
  pigment,
  fieldflow,
  warp,
];

/** Register the designed extended forces on a registry (§4) — opt-in, alongside the nine. */
export function registerExtendedForces(reg: Registry): void {
  for (const f of extendedForces) reg.force(f);
}
