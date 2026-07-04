/**
 * Dock — the pure, DOM-free decision core for element capture (§22.3, agent-consumption-model).
 *
 * The element-level analogue of particle capture: a `[data-move][data-dock]` element drifting under
 * the field, when it falls inside a `sink` body's capture radius, **docks** — it collapses toward the
 * sink core (translate + scale → 0) and is held until the sink releases (supernova), which restores
 * it. This module computes the trigger, the eased collapse progress, and the transform; `field.ts`
 * performs the DOM writes, the a11y toggle, and the `field:captured`/`field:released` dispatch.
 */

import type { Vec2 } from './types.ts';

/** Per-element collapse state: progress 0 (free) → 1 (fully docked at the sink). */
export interface DockState {
  dock: number;
}

/** Whether a screen point lies inside a sink's capture radius (the dock trigger). */
export function withinCapture(center: Vec2, sink: { cx: number; cy: number; absorbR: number }): boolean {
  const dx = sink.cx - center.x;
  const dy = sink.cy - center.y;
  return dx * dx + dy * dy < sink.absorbR * sink.absorbR;
}

/** Ease a dock progress toward `target` (1 docking, 0 releasing), snapping at the ends. */
export function stepDock(progress: number, target: 0 | 1, rate = 0.14): number {
  const next = progress + (target - progress) * rate;
  if (next < 0.001) return 0;
  if (next > 0.999) return 1;
  return next;
}

/**
 * The collapse transform for a docking element: translate from its current field offset toward the
 * sink centre and scale 1 → 0 as it docks. `home` is the element's layout-slot centre (its screen
 * centre at offset 0), `offset` its current field offset, `sink` the core centre. At progress 1 the
 * element sits at the sink centre, scaled to nothing.
 */
export function dockTransform(
  home: Vec2,
  offset: Vec2,
  sink: Vec2,
  progress: number
): { tx: number; ty: number; scale: number; opacity: number } {
  const curX = home.x + offset.x;
  const curY = home.y + offset.y;
  const tx = offset.x + (sink.x - curX) * progress;
  const ty = offset.y + (sink.y - curY) * progress;
  const scale = 1 - progress;
  return { tx, ty, scale, opacity: scale };
}
