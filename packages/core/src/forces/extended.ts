/**
 * Designed extended forces (§20.3, implementation class [A]).
 *
 * Like the canonical nine (§6) these are *designed* — finite range, soft falloff,
 * tuned for legibility — but they live outside the core nine as opt-in enrichments.
 * Class [A] means each acts on a single particle from the shared per-frame `env`,
 * needing no neighbour or grid services, so they register and test exactly like the
 * nine. Opt-in via `data-body="lens"` etc.; a page that doesn't ask is unaffected.
 */

import type { Force } from '../core/types.ts';
import type { Registry } from '../core/registry.ts';

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
 * §20.3 — `align` (the heading variant): steer velocity toward a fixed heading `ĥ`
 * while preserving speed — `v += (ĥ·|v| − v)·k_align`. The flocking-align primitive,
 * sourced from `data-angle` instead of neighbours (the `[B]` neighbour-mean variant
 * needs the `neighbors` service, deferred). `strength` is `k_align`.
 */
export const align: Force = {
  token: 'align',
  label: 'Align',
  apply(b, p, e) {
    if (e.dist >= b.range) return;
    const speed = Math.hypot(p.vx, p.vy); // steer toward ĥ·|v| → turns without speeding up
    const k = b.strength;
    p.vx += (b.ux * speed - p.vx) * k;
    p.vy += (b.uy * speed - p.vy) * k;
  },
  meta: { desc: 'steers velocity toward a heading, preserving speed (flock-align)' },
};

/** The designed extended forces, in spec order (§20.3). */
export const extendedForces: readonly Force[] = [lens, gate, buoyancy, shear, crystallize, align];

/** Register the designed extended forces on a registry (§4) — opt-in, alongside the nine. */
export function registerExtendedForces(reg: Registry): void {
  for (const f of extendedForces) reg.force(f);
}
