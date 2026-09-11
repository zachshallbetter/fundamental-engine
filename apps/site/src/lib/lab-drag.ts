/**
 * Lab direct manipulation — the pure, DOM-free geometry behind dragging the particle start
 * point, its initial-velocity arrow and the body on the Lab chamber (#696). The page owns the
 * pointer events, the overrides and the redraw; this module owns the world↔screen mapping,
 * the hit-testing order and the drag→value arithmetic, so those can be unit-tested without
 * a canvas (the same split as `field-probe.ts`).
 *
 * Frames. The conformance runner reports every result in a CENTRED frame (`runScenario`
 * translates the body and the particles by a fixed offset for most forces; not for the
 * NO_OFFSET ones). The Lab's overrides live in the scenario's INPUT frame. A drag therefore
 * never reads an absolute world position back — it applies the pointer's screen DELTA,
 * divided by the view scale, to the value captured at pointerdown. That is invariant under
 * any translation, so it is correct in both frames without knowing which one applies.
 */

/** Screen px per px/frame of velocity — the chamber's velocity-vector length. */
export const V_ARROW_PX = 6;
/**
 * Minimum stand-off of the velocity-tip handle from the start point (screen px). A particle at
 * rest would otherwise put its tip exactly on the start, and velocity-first hit priority would
 * make the start ungrabbable; the stub also gives a resting particle a visible launch handle.
 */
export const V_TIP_MIN = 16;
/** Hit radii (screen px) — start ring, velocity tip disc, body core. */
export const HANDLE_R = { start: 9, velocity: 7, body: 12 } as const;

export interface LabView {
  scale: number;
  ox: number;
  oy: number;
}
export type LabHandleKind = 'start' | 'velocity' | 'body';
export interface LabHandle {
  kind: LabHandleKind;
  sx: number;
  sy: number;
  r: number;
}
export interface LabPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface LabBodyPos {
  cx: number;
  cy: number;
}
/** Input-frame values captured at pointerdown (via the page's `valOf`). */
export interface LabDragOrigin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bx: number;
  by: number;
}
export interface LabScreenPt {
  sx: number;
  sy: number;
}

export function worldToScreen(v: LabView, x: number, y: number): [number, number] {
  return [x * v.scale + v.ox, y * v.scale + v.oy];
}
export function screenToWorld(v: LabView, sx: number, sy: number): [number, number] {
  return [(sx - v.ox) / v.scale, (sy - v.oy) / v.scale];
}

/**
 * Where the velocity-tip handle sits on screen for a start point at (sx, sy) with initial
 * velocity (vx, vy): `start + v0 * V_ARROW_PX`, pushed out to `V_TIP_MIN` along v0 (or +x at
 * rest) when the arrow is shorter than that.
 */
export function velocityTip(sx: number, sy: number, vx: number, vy: number): [number, number] {
  const ax = vx * V_ARROW_PX, ay = vy * V_ARROW_PX;
  const len = Math.hypot(ax, ay);
  if (len >= V_TIP_MIN) return [sx + ax, sy + ay];
  if (len < 1e-9) return [sx + V_TIP_MIN, sy];
  return [sx + (ax / len) * V_TIP_MIN, sy + (ay / len) * V_TIP_MIN];
}

/**
 * The draggable handles for the current run, in HIT-PRIORITY order: velocity tip, then the
 * start point, then the body. `p0` is the frame-0 state of the tracked particle (null for
 * spawn scenarios with no particles → no start/velocity handles); `body` is null for pair
 * forces, where the chamber draws no body. Both are read in whatever frame the result is in —
 * they are only used for screen positions.
 */
export function labHandles(v: LabView, p0: LabPoint | null, body: LabBodyPos | null): LabHandle[] {
  const out: LabHandle[] = [];
  if (p0) {
    const [sx, sy] = worldToScreen(v, p0.x, p0.y);
    const [tx, ty] = velocityTip(sx, sy, p0.vx, p0.vy);
    out.push({ kind: 'velocity', sx: tx, sy: ty, r: HANDLE_R.velocity });
    out.push({ kind: 'start', sx, sy, r: HANDLE_R.start });
  }
  if (body) {
    const [bx, by] = worldToScreen(v, body.cx, body.cy);
    out.push({ kind: 'body', sx: bx, sy: by, r: HANDLE_R.body });
  }
  return out;
}

/** The first handle (in the given order) whose radius + slop contains the screen point. */
export function hitLabHandle(handles: LabHandle[], sx: number, sy: number, slop = 4): LabHandle | null {
  for (const h of handles) if (Math.hypot(sx - h.sx, sy - h.sy) <= h.r + slop) return h;
  return null;
}

const roundTo = (n: number, step: number): number => {
  const d = step < 1 ? (String(step).split('.')[1] || '').length : 0;
  return Number((Math.round(n / step) * step).toFixed(d));
};

/**
 * The override values a drag produces: the pointer's screen delta from `from` to `to`, applied
 * to the input-frame `origin` captured at pointerdown. Positions move by Δscreen / scale and
 * round to 1 px; the velocity tip moves by Δscreen / V_ARROW_PX and rounds to 0.1 px/f — so
 * every written value is a valid multiple of its Tune-panel input step.
 */
export function applyLabDrag(
  kind: LabHandleKind,
  v: LabView,
  from: LabScreenPt,
  to: LabScreenPt,
  origin: LabDragOrigin,
): Partial<LabDragOrigin> {
  const dsx = to.sx - from.sx, dsy = to.sy - from.sy;
  const scale = v.scale || 1;
  switch (kind) {
    case 'start':
      return { x: roundTo(origin.x + dsx / scale, 1), y: roundTo(origin.y + dsy / scale, 1) };
    case 'body':
      return { bx: roundTo(origin.bx + dsx / scale, 1), by: roundTo(origin.by + dsy / scale, 1) };
    case 'velocity':
      return { vx: roundTo(origin.vx + dsx / V_ARROW_PX, 0.1), vy: roundTo(origin.vy + dsy / V_ARROW_PX, 0.1) };
  }
}
