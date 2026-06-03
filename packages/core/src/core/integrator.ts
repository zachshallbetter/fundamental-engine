/**
 * The integrator — advances the field one tick (§2.2, §7).
 *
 * For each free particle: apply DOM-body forces (§4), the formation bias (§7),
 * then integrate and damp. Mass is nominal here (the unit-mass path, §21.4);
 * first-class `a = F/m` arrives in Phase 6. Reduced motion (`dt = 0`) freezes
 * the sim (§18).
 */

import type { Body, ConditionRegistry, Env, ForceRegistry, Particle } from './types.ts';
import type { FieldStore } from './field-store.ts';
import { accretionTarget } from './formations.ts';
import { waveYat, waveSlope, type Wave } from './currents.ts';

export const FRICTION = 0.95;
export const HEAT_DECAY = 0.972;
const EDGE = 10;

export interface StepInput {
  store: FieldStore;
  bodies: readonly Body[];
  env: Env;
  forces: ForceRegistry;
  conditions: ConditionRegistry;
  /** the carrier waves — free particles drift along their slope (§2.3). */
  waves?: readonly Wave[];
}

function passes(conds: ConditionRegistry, b: Body, p: Particle): boolean {
  if (!b.when) return true;
  const fn = conds[b.when];
  return fn ? fn(b, p) : true;
}

export function step(input: StepInput): void {
  const { store, bodies, env, forces, conditions, waves } = input;
  const dt = env.dt;
  if (dt === 0) return;
  const { W, H, form } = env;
  for (const b of bodies) b.count = 0;
  const hasWaves = !!waves && waves.length > 0;
  const hasBodies = bodies.length > 0;
  // the accretion target for `conv` — the first visible absorb body (§7).
  const conv = form.conv > 0.02 ? accretionTarget(bodies) : null;

  for (const p of store.particles) {
    // captured matter is held inside an absorb core, drifting to it (§6.9).
    if (p.cap) {
      p.x += (p.cap.cx - p.x) * 0.18;
      p.y += (p.cap.cy - p.y) * 0.18;
      continue;
    }

    // wave current (§2.3): near a wave line, drift along its slope like debris.
    if (hasWaves) {
      let near: Wave | null = null;
      let nd = 1e9;
      for (const w of waves!) {
        const d = Math.abs(waveYat(w, p.x, env.t, H) - p.y);
        if (d < nd) {
          nd = d;
          near = w;
        }
      }
      if (near && nd < 70) {
        p.vx += near.dir * 0.035 * (1 - nd / 70);
        p.vy += waveSlope(near, p.x, env.t) * 0.1 * (1 - nd / 70);
      }
    }

    // formation currents (§7), before the body forces: a lateral lane, an
    // even-scatter pull toward a per-particle target, and convergence to the core.
    if (form.driftX) p.vx += form.driftX * 0.02;
    if (form.spread > 0.02) {
      const gx = p.gx ?? 0.5;
      const gy = p.gy ?? 0.5;
      const tx = ((gx + env.frameN * 0.00004) % 1) * W;
      const ty = gy * H;
      p.vx += (tx - p.x) * 0.0006 * form.spread;
      p.vy += (ty - p.y) * 0.0006 * form.spread;
    }
    if (conv) {
      const cdx = conv.cx - p.x;
      const cdy = conv.cy - p.y;
      const cd = Math.hypot(cdx, cdy) || 1;
      p.vx += (cdx / cd) * form.conv * 0.06;
      p.vy += (cdy / cd) * form.conv * 0.06;
    }

    // DOM body forces — the page's elements move the field (§4).
    if (hasBodies) {
      for (const b of bodies) {
        if (!b.vis || b.tokens.length === 0) continue;
        const dx = b.cx - p.x;
        const dy = b.cy - p.y;
        const d = Math.hypot(dx, dy);
        // density sampling for two-way feedback (engine bookkeeping, ungated, §8)
        if (b.feedback && d < b.range * 0.5) b.count += 1 - d / (b.range * 0.5);
        if (b.when && !passes(conditions, b, p)) continue;
        env.dx = dx;
        env.dy = dy;
        env.dist = d < 1 ? 1 : d;
        // modifier pass (§20.3): resonate scales sibling strength, spotlight gates it.
        let sMul = 1;
        let gated = false;
        let hasModifier = false;
        for (const tok of b.tokens) {
          const mod = forces[tok]?.modify;
          if (!mod) continue;
          hasModifier = true;
          const m = mod(b, p, env);
          if (m.strength != null) sMul *= m.strength;
          if (m.gate) gated = true;
        }
        if (gated) continue; // spotlight cone excludes this particle
        if (!hasModifier) {
          for (const tok of b.tokens) forces[tok]?.apply(b, p, env);
        } else {
          const origS = b.strength;
          b.strength = origS * sMul; // resonate's time-varying S(t)
          for (const tok of b.tokens) {
            const f = forces[tok];
            if (f && !f.modify) f.apply(b, p, env);
          }
          b.strength = origS;
        }
      }
    }

    // integrate, then damp (§2.2).
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= FRICTION;
    p.vy *= FRICTION;

    // wander (after damping, so it stays lively): a periodic brownian jitter
    // every 40 frames, plus a smooth curl-noise eddy (§7).
    if (env.frameN % 40 === 0 && form.wander > 0) {
      const wsc = 0.05 * form.wander;
      p.vx += (Math.random() - 0.5) * wsc;
      p.vy += (Math.random() - 0.5) * wsc;
    }
    if (form.wander > 0.05) {
      const cn =
        (Math.sin(p.x * 0.0032 + env.t * 0.12) + Math.cos(p.y * 0.0034 - env.t * 0.15)) *
        Math.PI;
      p.vx += Math.cos(cn) * 0.013 * form.wander;
      p.vy += Math.sin(cn) * 0.013 * form.wander;
    }

    p.heat *= HEAT_DECAY;

    // toroidal wrap at the edges.
    if (p.x < -EDGE) p.x = W + EDGE;
    else if (p.x > W + EDGE) p.x = -EDGE;
    if (p.y < -EDGE) p.y = H + EDGE;
    else if (p.y > H + EDGE) p.y = -EDGE;
  }
}
