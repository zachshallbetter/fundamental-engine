/**
 * Built-in `data-when` gate predicates (§5). Selective gates read each
 * particle; `active` reads the body. `scrolling` needs scroll state and lands
 * with the interaction layer.
 */

import type { Body, Condition, ConditionRegistry, Particle } from './types.ts';

export const conditions: ConditionRegistry = {
  active: (b) => b.on,
  fast: (_b, p) => p.vx * p.vx + p.vy * p.vy > 0.9,
  slow: (_b, p) => p.vx * p.vx + p.vy * p.vy < 0.22,
  hot: (_b, p) => p.heat > 0.3,
  cool: (_b, p) => p.heat < 0.08,
};

/** Does body `b`'s gate pass for particle `p`? Empty gate (`''`) always passes. */
export function passes(reg: ConditionRegistry, b: Body, p: Particle): boolean {
  if (!b.when) return true;
  const fn: Condition | undefined = reg[b.when];
  return fn ? fn(b, p) : true;
}
