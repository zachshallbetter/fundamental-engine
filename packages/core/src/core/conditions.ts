/**
 * Built-in `data-when` gate predicates (§5). Selective gates read each particle;
 * `active` reads the body; `scrolling` reads the shared frame state (`env.scrollV`),
 * so it acts only while the page is actually scrolling.
 */

import type { Body, Condition, ConditionRegistry, Env, Particle } from './types.ts';

export const conditions: ConditionRegistry = {
  active: (b) => b.on,
  // speed gates read the full 3D speed (z-axis.md) — vz is 0 in a flat field.
  fast: (_b, p) => p.vx * p.vx + p.vy * p.vy + (p.vz ?? 0) * (p.vz ?? 0) > 0.9,
  slow: (_b, p) => p.vx * p.vx + p.vy * p.vy + (p.vz ?? 0) * (p.vz ?? 0) < 0.22,
  hot: (_b, p) => p.heat > 0.3,
  cool: (_b, p) => p.heat < 0.08,
  scrolling: (_b, _p, env) => (env?.scrollV ?? 0) > 0.25,
};

/** Does body `b`'s gate pass for particle `p`? Empty gate (`''`) always passes. */
export function passes(reg: ConditionRegistry, b: Body, p: Particle, env?: Env): boolean {
  if (!b.when) return true;
  const fn: Condition | undefined = reg[b.when];
  return fn ? fn(b, p, env) : true;
}
