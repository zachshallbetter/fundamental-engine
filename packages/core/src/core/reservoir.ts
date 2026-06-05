/**
 * The bound↔free reservoir (§2.4) — the conserved exchange between the calm
 * matter riding the Currents (bound) and the roaming matter (free).
 *
 * - **Wave-healing:** calm free particles already near a line drift onto it and,
 *   when very close and slow, snap to bound — but only up to `boundTarget`, so
 *   the lines never vacuum the open field.
 * - **Tearing:** a disturbance (supernova / burst) rips nearby bound matter
 *   loose, returning it to the free pool with an outward kick.
 *
 * Count is conserved throughout: nothing is created or destroyed, only moved.
 */

import type { FieldStore } from './field-store.ts';
import type { Body, Particle } from './types.ts';
import { waveYat, type Wave, type BoundParticle } from './currents.ts';

/** Reclaim calm free matter onto the nearest line, up to `boundTarget` (§2.4). */
export function healWaves(
  store: FieldStore,
  bound: BoundParticle[],
  boundTarget: number,
  waves: readonly Wave[],
  W: number,
  H: number,
  time: number,
  rand: () => number
): void {
  if (waves.length === 0) return;
  const ps = store.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    if (bound.length >= boundTarget) break;
    const p = ps[i];
    if (!p || p.cap || p.heat >= 0.12) continue;

    // nearest wave line
    let nwi = -1;
    let nwd = 1e9;
    let nwy = 0;
    for (let wi = 0; wi < waves.length; wi++) {
      const wy = waveYat(waves[wi]!, p.x, time, H);
      const dd = Math.abs(wy - p.y);
      if (dd < nwd) {
        nwd = dd;
        nwi = wi;
        nwy = wy;
      }
    }
    if (nwi < 0 || nwd >= 64) continue;

    // drift toward the line; snap home when very close, calm, and (rarely) lucky.
    const pull = Math.min(0.012, nwd * 0.0004) * (1 - p.heat / 0.12);
    p.vy += nwy > p.y ? pull : -pull;
    if (nwd < 20 && p.vx * p.vx + p.vy * p.vy < 0.3 && rand() < 0.03) {
      bound.push({
        wi: nwi,
        progress: p.x / W,
        phase: (rand() - 0.5) * 0.22 * Math.PI,
        size: p.size,
        glow: rand() < 0.3,
        speed: (0.00035 + rand() * 0.0009) * (rand() < 0.5 ? 1 : -1),
      });
      store.remove(p);
    }
  }
}

/** Tear bound matter within `radius` of (cx, cy) loose into the free pool (§6.9). */
export function tearBoundNear(
  bound: BoundParticle[],
  waves: readonly Wave[],
  cx: number,
  cy: number,
  radius: number,
  W: number,
  H: number,
  time: number,
  spawn: (p: Partial<Particle>) => void
): void {
  for (let i = bound.length - 1; i >= 0; i--) {
    const p = bound[i];
    if (!p) continue;
    const w = waves[p.wi];
    if (!w) continue;
    const x = p.progress * W;
    const y = waveYat(w, x, time, H) + p.phase * 32;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d < radius && d > 0.5) {
      const f = (1 - d / radius) * 4;
      spawn({ x, y, vx: (dx / d) * f, vy: (dy / d) * f, size: p.size, heat: 0.9 });
      const last = bound.pop();
      if (last && i < bound.length) bound[i] = last;
    }
  }
}

/**
 * Force-tearing (§2.4): any force reaching a bound particle tears it loose into
 * the free pool with a kick, so it then *feels* the force (otherwise the shimmer
 * would ride the lines straight through a body). Selective gates act on free
 * matter only, so only always/active bodies tear bound.
 */
export function tearBoundByForces(
  bound: BoundParticle[],
  waves: readonly Wave[],
  bodies: readonly Body[],
  W: number,
  H: number,
  time: number,
  spawn: (p: Partial<Particle>) => void
): void {
  for (let i = bound.length - 1; i >= 0; i--) {
    const p = bound[i];
    if (!p) continue;
    const w = waves[p.wi];
    if (!w) continue;
    const x = p.progress * W;
    const y = waveYat(w, x, time, H) + p.phase * 32;

    let hit = false;
    let kx = 0;
    let ky = 0;
    for (const b of bodies) {
      if (!b.vis) continue;
      if (b.when === 'active' && !b.on) continue;
      if (b.when && b.when !== 'active') continue; // selective → free agents only
      const toks = b.tokens;
      const dx = b.cx - x;
      const dy = b.cy - y;
      const dist = Math.hypot(dx, dy) || 1;
      const range = b.range * (b.on ? 1.4 : 1);

      if (toks.indexOf('reflect') >= 0) {
        const pad = 6;
        if (Math.abs(x - b.cx) < b.hw + pad && Math.abs(y - b.cy) < b.hh + pad) {
          kx = (x < b.cx ? -1 : 1) * 1.6;
          ky = (y < b.cy ? -1 : 1) * 0.8;
          hit = true;
        }
      }
      if (!hit && (toks.indexOf('attract') >= 0 || toks.indexOf('absorb') >= 0 || toks.indexOf('emitter') >= 0)) {
        if (dist < range * 0.8) {
          const k = 1.2 + (b.on ? 1.6 : 0);
          kx = (dx / dist) * k;
          ky = (dy / dist) * k;
          hit = true;
        }
      }
      if (!hit && toks.indexOf('repel') >= 0 && dist < range * 0.8) {
        const k = 1.2 + (b.on ? 1.2 : 0);
        kx = -(dx / dist) * k;
        ky = -(dy / dist) * k;
        hit = true;
      }
      if (!hit && toks.indexOf('vortex') >= 0 && dist < range * 0.75) {
        kx = (dy / dist) * 1.2;
        ky = -(dx / dist) * 1.2;
        hit = true;
      }
      if (!hit && toks.indexOf('stream') >= 0 && dist < range * 0.75) {
        kx = b.ux * 1.3;
        ky = b.uy * 1.3;
        hit = true;
      }
      if (hit) break;
    }

    if (hit) {
      spawn({ x, y, vx: kx, vy: ky, size: p.size, heat: 0.5 });
      const last = bound.pop();
      if (last && i < bound.length) bound[i] = last;
    }
  }
}
