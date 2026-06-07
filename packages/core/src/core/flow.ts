/**
 * Flow control (controlled, dynamically-targeted field lines). A *flow focus* is a movable point the
 * field bends toward: it pulls free matter in, curves the visible streamlines / wave spine, and can
 * be retargeted every frame (follow the pointer, track an element, animate a path). It is not a DOM
 * body — it is a transient field influence the renderer applies, exposed through `field.flowTo()` /
 * `field.clearFlow()`.
 *
 * The math is pure here so it is deterministic and node-testable; the renderer in `field.ts` applies
 * `flowBias` to particles and to the streamline grid, and eases the wave spine toward the focus.
 */
import type { Vec2 } from './types.ts';

export interface FlowFocus {
  x: number;
  y: number;
  /** pull magnitude multiplier (≈ [0, 2]); 1 is a firm, legible pull. */
  strength: number;
  /** reach in px — past this the focus has no effect. */
  radius: number;
}

/** Options accepted by `field.flowTo()`. */
export interface FlowOptions {
  /** pull magnitude (default 1). */
  strength?: number;
  /** reach in px (default 360). */
  radius?: number;
}

export const FLOW_DEFAULT_STRENGTH = 1;
export const FLOW_DEFAULT_RADIUS = 360;

/** Build a FlowFocus from a target point + options, applying the defaults. Pure. */
export function makeFlowFocus(x: number, y: number, opts: FlowOptions = {}): FlowFocus {
  return {
    x,
    y,
    strength: opts.strength ?? FLOW_DEFAULT_STRENGTH,
    radius: opts.radius && opts.radius > 0 ? opts.radius : FLOW_DEFAULT_RADIUS,
  };
}

/**
 * The vector a flow focus contributes at a point `(px, py)`: a unit pull toward the focus scaled by
 * `strength`, falling off linearly to zero at `radius` (and zero outside it, or exactly on it). The
 * renderer uses this both to nudge particle velocity (`gain` ≈ 0.6) and to bend the streamline grid
 * (`gain` ≈ the field scale). Pure — same inputs, same vector.
 */
export function flowBias(px: number, py: number, f: FlowFocus, gain = 0.6): Vec2 {
  const dx = f.x - px;
  const dy = f.y - py;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= f.radius) return { x: 0, y: 0 };
  const fall = (1 - d / f.radius) * f.strength * gain;
  return { x: (dx / d) * fall, y: (dy / d) * fall };
}
