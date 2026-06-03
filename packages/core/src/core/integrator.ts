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

export const FRICTION = 0.95;
export const HEAT_DECAY = 0.972;
const EDGE = 10;

export interface StepInput {
  store: FieldStore;
  bodies: readonly Body[];
  env: Env;
  forces: ForceRegistry;
  conditions: ConditionRegistry;
}

function passes(conds: ConditionRegistry, b: Body, p: Particle): boolean {
  if (!b.when) return true;
  const fn = conds[b.when];
  return fn ? fn(b, p) : true;
}

export function step(input: StepInput): void {
  const { store, bodies, env, forces, conditions } = input;
  const dt = env.dt;
  if (dt === 0) return;
  const { W, H, form } = env;
  const hasBodies = bodies.length > 0;

  for (const p of store.particles) {
    // captured matter is held inside an absorb core (§6.9) — Phase 2.
    if (p.cap) continue;

    if (hasBodies) {
      for (const b of bodies) {
        if (!b.vis || b.tokens.length === 0) continue;
        if (b.when && !passes(conditions, b, p)) continue;
        const dx = b.cx - p.x;
        const dy = b.cy - p.y;
        const d = Math.hypot(dx, dy);
        env.dx = dx;
        env.dy = dy;
        env.dist = d < 1 ? 1 : d;
        for (const tok of b.tokens) forces[tok]?.apply(b, p, env);
      }
    }

    // formation bias (§7). Implemented: lateral current + curl-noise drift.
    // TODO(Phase 2): periodic brownian jitter (every 40 frames); `spread` (needs
    // Particle.gx/gy) and `conv` (needs the accretion target); and ease `form`
    // transitions (lerp 0.03/frame) instead of swapping instantly in setFormation.
    if (form.driftX) p.vx += form.driftX * 0.02;
    if (form.wander > 0.05) {
      const cn =
        (Math.sin(p.x * 0.0032 + env.t * 0.12) + Math.cos(p.y * 0.0034 - env.t * 0.15)) *
        Math.PI;
      p.vx += Math.cos(cn) * 0.013 * form.wander;
      p.vy += Math.sin(cn) * 0.013 * form.wander;
    }

    // integrate, then damp (§2.2).
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= FRICTION;
    p.vy *= FRICTION;
    p.heat *= HEAT_DECAY;

    // toroidal wrap at the edges.
    if (p.x < -EDGE) p.x = W + EDGE;
    else if (p.x > W + EDGE) p.x = -EDGE;
    if (p.y < -EDGE) p.y = H + EDGE;
    else if (p.y > H + EDGE) p.y = -EDGE;
  }
}
