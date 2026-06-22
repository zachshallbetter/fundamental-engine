/**
 * Element agents (§22.4) — a force can move a DOM element by a transform offset,
 * with an anchor spring pulling it back to its layout slot. Pure integration
 * here; the per-frame force probe and the transform writes live in the field loop.
 */
import type { Vec2 } from './types.ts';

export interface ElementOffset {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Integrate an element's offset under a net force (element mass + damping, §22.4). */
export function integrateOffset(
  o: ElementOffset,
  fx: number,
  fy: number,
  mEl: number,
  friction = 0.9,
  maxOffset = 80
): void {
  const m = mEl > 0 ? mEl : 1;
  o.vx = (o.vx + fx / m) * friction;
  o.vy = (o.vy + fy / m) * friction;
  o.x += o.vx;
  o.y += o.vy;
  const d = Math.hypot(o.x, o.y);
  if (d > maxOffset) {
    o.x = (o.x / d) * maxOffset;
    o.y = (o.y / d) * maxOffset;
  }
}

/** The anchor-spring force pulling an offset back toward home (o = 0, §22.4). */
export function anchorForce(o: ElementOffset, k = 0.02): Vec2 {
  return { x: -o.x * k, y: -o.y * k };
}

/** Element inertial mass from its rendered area (heavier = harder to move). */
export function elementMass(area: number): number {
  const m = area / 30000;
  return m < 0.6 ? 0.6 : m > 6 ? 6 : m;
}

/**
 * Self-laying-out repulsion (Concept 3): every other element pushes this one away,
 * `Σ C·(c − cⱼ)/|c − cⱼ|²` — so a cluster spreads out. Softened near coincidence so
 * fully-overlapping elements don't blow up. `others` are the other element centres.
 */
export function repelForce(self: Vec2, others: readonly Vec2[], skip = -1, C = 1600, soft = 26): Vec2 {
  let fx = 0;
  let fy = 0;
  const s2 = soft * soft;
  for (let i = 0; i < others.length; i++) {
    if (i === skip) continue; // exclude self by index — saves a per-frame `others.filter(j !== i)` alloc (#530)
    const o = others[i]!;
    const dx = self.x - o.x;
    const dy = self.y - o.y;
    const d2 = dx * dx + dy * dy + s2; // softened |c − cⱼ|²
    fx += (C * dx) / d2; // magnitude ≈ C/|d| along the separation unit vector
    fy += (C * dy) / d2;
  }
  return { x: fx, y: fy };
}

/**
 * Density-pressure force (Concept 3): push an element *down* the local density gradient
 * (toward emptier field), `−∇ρ`, estimated by a 4-tap finite difference of a density
 * sampler at `±delta`. So elements drift off crowded matter toward open space.
 */
export function densityPush(
  sample: (x: number, y: number) => number,
  x: number,
  y: number,
  delta = 16,
  scale = 1
): Vec2 {
  const gx = (sample(x + delta, y) - sample(x - delta, y)) / (2 * delta);
  const gy = (sample(x, y + delta) - sample(x, y - delta)) / (2 * delta);
  return { x: -gx * scale, y: -gy * scale }; // negative gradient → toward lower density
}
