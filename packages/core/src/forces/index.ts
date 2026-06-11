/**
 * The canonical nine forces (§6) as registry modules.
 *
 * Each is an independent `Force` — the engine never changes to add one (§4).
 * The math is the exact per-frame implementation from `docs/engine-reference/forces-system.md`
 * §6.1–§6.9. `e.dx/e.dy` point from the particle toward the body; `e.dist ≥ 1`.
 * On-state (`b.on`) widens range and boosts strength per the spec.
 */

import type { Force } from '../core/types.ts';
import type { Registry } from '../core/registry.ts';
import { FORCE_BY } from '../config/forces.config.ts';

/** §6.1 — a soft gravity-like well, with optional orbital swirl. */
export const attract: Force = {
  token: 'attract',
  label: 'Attract',
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.5 : 1);
    const s = b.strength * (b.on ? 3 : 1);
    if (e.dist >= range) return;
    const f = (1 - e.dist / range) ** 2 * s * 0.5;
    const ux = e.dx / e.dist;
    const uy = e.dy / e.dist;
    p.vx += ux * f;
    p.vy += uy * f;
    if (e.form.orbit) {
      p.vx += -uy * f * e.form.orbit; // tangential swirl → orbits
      p.vy += ux * f * e.form.orbit;
    }
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.9);
  },
  meta: { desc: 'a soft gravity-like well, bent into a spiral' },
};

/** §6.6 — inverse-square outward push; carves a void. */
export const repel: Force = {
  token: 'repel',
  label: 'Repel',
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.4 : 1);
    const s = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = (1 - e.dist / range) ** 2 * s * 0.5;
    p.vx -= (e.dx / e.dist) * f;
    p.vy -= (e.dy / e.dist) * f;
  },
  meta: { desc: 'inverse-square outward push' },
};

/** §6.8 — tangential swirl with light inward retention. */
export const swirl: Force = {
  token: 'swirl',
  label: 'Swirl',
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.4 : 1);
    const s = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = (1 - e.dist / range) ** 1.4 * s * 0.45;
    const spin = b.spin;
    const ux = e.dx / e.dist;
    const uy = e.dy / e.dist;
    // tangential swirl with a light inward retention (0.12): the swirl dominates ~8×, so
    // canonical swirl reads as a designed spin, not a drain. A tight inward-binding
    // whirlpool belongs in a preset (`whirlpool` / `blackhole` / `accretion`), not here.
    p.vx += uy * f * spin + ux * f * 0.12;
    p.vy += -ux * f * spin + uy * f * 0.12;
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.6);
  },
  meta: { desc: 'tangential swirl with light inward retention' },
};

/** §6.5 — a steady directional current along the heading. */
export const stream: Force = {
  token: 'stream',
  label: 'Stream',
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.4 : 1);
    const s = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = (1 - e.dist / range) ** 1.1 * s * 0.5;
    p.vx += b.ux * f;
    p.vy += b.uy * f;
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.5);
  },
  meta: { desc: 'directional current along a heading' },
};

/** §6.7 — viscosity; bleeds momentum, no redirection. */
export const viscosity: Force = {
  token: 'viscosity',
  label: 'Viscosity',
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.4 : 1);
    if (e.dist >= range) return;
    const k = (1 - e.dist / range) * (0.05 + b.strength * 0.07) * (b.on ? 1.6 : 1);
    p.vx -= p.vx * k;
    p.vy -= p.vy * k;
  },
  meta: { desc: 'thickens the medium — bleeds momentum' },
};

/** §6.2 — a conduit: draws matter in, jets it out along the heading. */
export const jet: Force = {
  token: 'jet',
  label: 'Jet',
  kinematic: true, // relaunches matter at the nozzle (sets velocity), so mass must not scale it
  apply(b, p, e) {
    const range = b.range * (b.on ? 1.4 : 1);
    if (e.dist >= range) return;
    if (e.dist < 24) {
      // at the nozzle: relaunch as a hot jet, with a cone of spread.
      const sp = ((e.rng ?? Math.random)() - 0.5) * 0.8;
      const cs = Math.cos(sp);
      const sn = Math.sin(sp);
      const hx = b.ux * cs - b.uy * sn;
      const hy = b.ux * sn + b.uy * cs;
      const spd = 2.4 + b.strength * 2.6;
      p.vx = hx * spd;
      p.vy = hy * spd;
      p.x = b.cx + hx * 26;
      p.y = b.cy + hy * 26;
      p.heat = Math.max(p.heat, 0.9);
    } else {
      // feed: draw surrounding matter toward the nozzle.
      const f = (1 - e.dist / range) ** 2 * (0.25 + b.strength * 0.15);
      p.vx += (e.dx / e.dist) * f;
      p.vy += (e.dy / e.dist) * f;
    }
  },
  meta: { desc: 'a fountain — draws matter in, jets it out along a heading' },
};

/** §6.3 — a tether with a rest length; holds matter at a shell radius. */
export const tether: Force = {
  token: 'tether',
  label: 'Tether',
  apply(b, p, e) {
    const rest = b.range * 0.6 * (b.on ? 1.25 : 1);
    const reach = rest * 2.1;
    if (e.dist >= reach) return;
    const k = (0.006 + b.strength * 0.012) * (b.on ? 1.7 : 1);
    const stretch = e.dist - rest;
    const ux = e.dx / e.dist;
    const uy = e.dy / e.dist;
    p.vx += ux * stretch * k;
    p.vy += uy * stretch * k;
    p.vx *= 0.985;
    p.vy *= 0.985;
    if (b.on) p.heat = Math.max(p.heat, (1 - Math.min(1, Math.abs(stretch) / rest)) * 0.5);
  },
  meta: { desc: 'a tether with a rest length — holds matter at a fixed radius' },
};

/** §6.4 — an axis-aligned bouncing wall; sparks on hard impact. */
export const wall: Force = {
  token: 'wall',
  label: 'Wall',
  kinematic: true, // an elastic bounce reflects velocity regardless of inertia
  apply(b, p, e) {
    const pad = 6;
    const ox = Math.abs(p.x - b.cx);
    const oy = Math.abs(p.y - b.cy);
    if (ox >= b.hw + pad || oy >= b.hh + pad) return;
    const speed = Math.hypot(p.vx, p.vy);
    const px = b.hw + pad - ox;
    const py = b.hh + pad - oy;
    if (px < py) {
      p.x = p.x < b.cx ? b.cx - b.hw - pad : b.cx + b.hw + pad;
      p.vx = -p.vx * 0.85;
    } else {
      p.y = p.y < b.cy ? b.cy - b.hh - pad : b.cy + b.hh + pad;
      p.vy = -p.vy * 0.85;
    }
    if (speed > 0.7) {
      e.spark(p.x, p.y, Math.min(2.4, speed), FORCE_BY.wall.color);
      p.heat = Math.max(p.heat, Math.min(0.85, speed * 0.4));
    }
  },
  meta: { desc: 'axis-aligned bouncing wall — sparks on impact' },
};

/** §6.9 — captures matter (held, conserved), then releases on saturation. */
export const sink: Force = {
  token: 'sink',
  label: 'Sink',
  apply(b, p, e) {
    if (p.cap || e.dist >= b.absorbR) return;
    p.cap = b;
    b.accreted += 1;
    if (b.accreted >= b.capacity) e.supernova(b);
  },
  meta: { desc: 'captures matter, then releases it' },
};

/** The canonical nine, in spec order. */
export const coreForces: readonly Force[] = [
  attract,
  jet,
  tether,
  wall,
  stream,
  repel,
  viscosity,
  swirl,
  sink,
];

/** Register the canonical nine on a registry (§4). */
export function registerCoreForces(reg: Registry): void {
  for (const f of coreForces) reg.force(f);
}
