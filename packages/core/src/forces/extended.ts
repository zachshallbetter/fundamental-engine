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

/** The designed extended forces, in spec order (§20.3). */
export const extendedForces: readonly Force[] = [lens, gate];

/** Register the designed extended forces on a registry (§4) — opt-in, alongside the nine. */
export function registerExtendedForces(reg: Registry): void {
  for (const f of extendedForces) reg.force(f);
}
