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
