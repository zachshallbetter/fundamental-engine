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
  let dead: Particle[] | null = null; // mortal (spawned) matter that expired this tick
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
      // first-class mass (§21.3): the body forces are accelerations, so the velocity
      // they impart is scaled by 1/m. Captured here and divided after the pass — no
      // force needs to know about mass. Unit-mass particles (m = 1) are untouched.
      const vx0 = p.vx;
      const vy0 = p.vy;
      for (const b of bodies) {
        if (!b.vis || b.tokens.length === 0) continue;
        const dx = b.cx - p.x;
        const dy = b.cy - p.y;
        const d2 = dx * dx + dy * dy;
        // range cull: a ranged body can't reach past ~1.6× its range (the largest
        // on-state multiplier, spring's 1.575×). Skip the sqrt, the modifier pass,
        // and every apply for matter beyond it. range 0 = global → never culled.
        if (b.range > 0 && d2 >= b.range * b.range * 2.56) continue;
        const d = Math.sqrt(d2);
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
        // conserved-attention multiplier (§2.4): a page-level effective strength,
        // 1 = neutral (the default, so the live field is untouched until opted in).
        const attn = b.attn ?? 1;
        if (!hasModifier && attn === 1) {
          for (const tok of b.tokens) forces[tok]?.apply(b, p, env);
        } else if (!hasModifier) {
          const origS = b.strength;
          b.strength = origS * attn;
          for (const tok of b.tokens) forces[tok]?.apply(b, p, env);
          b.strength = origS;
        } else {
          const origS = b.strength;
          b.strength = origS * sMul * attn; // resonate's S(t) × attention budget
          for (const tok of b.tokens) {
            const f = forces[tok];
            if (f && !f.modify) f.apply(b, p, env);
          }
          b.strength = origS;
        }
      }
      if (p.m !== 1 && p.m > 0) {
        const inv = 1 / p.m; // a = F/m: scale the force-induced Δv by 1/mass
        p.vx = vx0 + (p.vx - vx0) * inv;
        p.vy = vy0 + (p.vy - vy0) * inv;
      }
    }

    // global safety cap (§20.10): no token or composite may drive a free particle past
    // c (the unit system's "speed of light"). The natural primitives self-clamp; this
    // enforces it for *every* force. A non-finite velocity slips the `> c²` test — the
    // conformance safety sweep is what catches a NaN-producing force.
    const cap = env.c;
    const sp2 = p.vx * p.vx + p.vy * p.vy;
    if (sp2 > cap * cap) {
      const k = cap / Math.sqrt(sp2);
      p.vx *= k;
      p.vy *= k;
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

    // mortal matter ages (the class-[S] sink): spawned particles carry a finite `age`
    // and despawn at ≤ 0, so a continuous source stays budgeted. Immortal base-field
    // matter (age undefined) is untouched — the conserved field is unchanged.
    if (p.age != null) {
      p.age -= dt;
      if (p.age <= 0) (dead ??= []).push(p);
    }

    // toroidal wrap at the edges.
    if (p.x < -EDGE) p.x = W + EDGE;
    else if (p.x > W + EDGE) p.x = -EDGE;
    if (p.y < -EDGE) p.y = H + EDGE;
    else if (p.y > H + EDGE) p.y = -EDGE;
  }

  // class-[S] sources (§20.1): a body-level pass *after* the per-particle loop, so a
  // source emits matter once per frame (not once per existing particle) via env.spawn.
  if (hasBodies) {
    for (const b of bodies) {
      if (!b.vis || b.tokens.length === 0) continue;
      for (const tok of b.tokens) forces[tok]?.source?.(b, env);
    }
  }

  // remove expired mortal matter (swap-remove is O(1); order is not significant).
  if (dead) for (const p of dead) store.remove(p);
}
