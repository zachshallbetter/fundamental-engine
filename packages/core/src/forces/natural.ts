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
  meta: { desc: 'signed inverse-square — like repels, opposite attracts' },
};

/**
 * §20.10 — the Lorentz force on a moving charge. In 2D the magnetic field `B` is a
 * scalar out of the plane, so the force is perpendicular to velocity: it curves a
 * particle's path into a circle (cyclotron radius `r_L = m|v|/(qB)`) **without doing
 * work** — speed is preserved, only the heading turns. The body's `spin` sets the
 * out-of-plane sense (which way it curls); `strength` is `|B|`. Acts only on charged,
 * *moving* matter; neutral particles pass straight through.
 */
export const magnetism: Force = {
  token: 'magnetism',
  label: 'Magnetism',
  apply(b, p, e) {
    if (e.dist >= b.range) return; // inside the field region
    const q = p.charge ?? 0;
    if (q === 0) return; // the Lorentz force needs charge
    const f = q * b.spin * b.strength; // qB; spin sets the out-of-plane sense
    const fx = -p.vy * f; // F = qB·(−v_y, v_x) — ⟂ to v, so F·v = 0 (no work)
    const fy = p.vx * f;
    p.vx += fx;
    p.vy += fy;
    clampToC(p, e.c);
  },
  meta: { desc: 'Lorentz force — curves a moving charge perpendicular to its velocity' },
};

/** The natural primitives, in spec order (§20.10). */
export const naturalForces: readonly Force[] = [gravity, charge, magnetism];

/** Register the natural primitives on a registry (§4) — opt-in, alongside the nine. */
export function registerNaturalForces(reg: Registry): void {
  for (const f of naturalForces) reg.force(f);
}
