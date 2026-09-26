/**
 * Pointer dynamics + throw (#666) — the cursor as a participant in the field, and the velocity a
 * dragged element keeps when you let go of it.
 *
 * Two things the engine had no vocabulary for, and they are the same thing seen from both ends:
 * **a moving hand carries matter with it**, and **matter released while moving keeps moving.**
 *
 * The cursor is not a `flowTo` focus. A flow focus is a *place* the field bends toward; retarget it
 * every frame and matter streams to wherever it now is. A pointer has a **velocity**, and velocity
 * is the whole point: a still cursor leaves no wake at all, a slow drift entrains gently, a flick
 * pulls a streak of matter behind it. That difference is what makes a cursor read as a finger
 * through sand rather than a magnet being slid around.
 *
 * All pure here — position, smoothed velocity, and the two vectors — so the dynamics are
 * deterministic and node-testable. `field.ts` owns the transient body and applies the wake.
 */
import type { Vec2 } from './types.ts';

/** Reach of the pointer's wake in px. Past this it carries nothing. */
export const POINTER_DEFAULT_RADIUS = 120;

/** Wake magnitude multiplier; 1 is a legible carry without matter sticking to the cursor. */
export const POINTER_DEFAULT_STRENGTH = 1;

/**
 * The speed (px/second) at which the wake reaches full strength — a brisk flick. Below it the carry
 * scales down linearly, so an idling hand does not stir the field and a deliberate sweep does. This
 * is the constant that separates a pointer from a flow focus; at 0 they would be the same thing.
 */
export const POINTER_REFERENCE_SPEED = 1200;

/**
 * Exponential smoothing on the sampled velocity. Raw pointer deltas are noisy — a browser can hand
 * you two events in the same millisecond and then none for 30 — and unsmoothed velocity makes the
 * wake stutter. 0.35 keeps a flick responsive while ignoring single-sample spikes.
 */
export const POINTER_VELOCITY_SMOOTHING = 0.35;

/**
 * Seconds of silence after which a pointer's velocity is treated as spent. A host that stops
 * reporting — the cursor left the window, the tab lost focus, the drag ended without a release
 * event — must not leave a stale velocity dragging matter across the field forever. The POSITION
 * stays (the cursor is still somewhere); only the carry decays.
 */
export const POINTER_IDLE_SECONDS = 0.12;

/** Ceiling on sampled speed (px/second). A pointer teleport — tab-switch, remote desktop, a
 *  synthetic event — must not become an impulse nothing in the field can absorb. */
export const POINTER_MAX_SPEED = 4000;

/** Options for `field.pointer()`. */
export interface PointerOptions {
  /** wake reach in px (default 120). */
  radius?: number;
  /** wake magnitude (default 1). */
  strength?: number;
  /** the force token(s) the cursor's own body carries (default `'repel'` — a finger pushes matter
   *  aside). Any real token works: `'attract'` makes the cursor gather, `'swirl'` makes it stir. */
  tokens?: string | readonly string[];
  /** the cursor body's force strength (default 1). */
  bodyStrength?: number;
  /** the cursor body's force range in px (default 160). */
  bodyRange?: number;
  /**
   * Sample time in **milliseconds**, for the velocity estimate. Defaults to the field's own clock.
   *
   * Pass it when that clock is pinned — a field constructed with `now` (a deterministic test, a
   * replay) reports the same instant forever, so every sample would measure a zero interval and the
   * pointer would have no velocity and therefore **no wake at all**, silently. Pass it also to replay
   * a recorded gesture at its original timing rather than at the rate you feed it. A host with a real
   * clock can hand through `event.timeStamp`; omitting it is correct for the ordinary live case.
   */
  at?: number;
}

/** A live pointer: where it is, how fast it is going, and how long since anyone said so. */
export interface PointerState {
  x: number;
  y: number;
  /** smoothed velocity, px/second. */
  vx: number;
  vy: number;
  /** seconds since the last `trackPointer` — drives the idle decay. */
  idle: number;
  radius: number;
  strength: number;
}

/** A pointer at rest at `(x, y)` — no velocity until it is tracked at least twice. */
export function makePointer(x: number, y: number, opts: PointerOptions = {}): PointerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    idle: 0,
    radius: opts.radius && opts.radius > 0 ? opts.radius : POINTER_DEFAULT_RADIUS,
    strength: opts.strength ?? POINTER_DEFAULT_STRENGTH,
  };
}

/**
 * Move a pointer to `(x, y)`, `seconds` after its last sample, and fold the implied velocity into
 * the smoothed estimate. Mutates and returns `p`.
 *
 * A non-positive `seconds` (two events in the same millisecond, a duplicate sample) moves the
 * position and leaves the velocity alone rather than dividing by zero — the next real interval will
 * carry the displacement anyway.
 */
export function trackPointer(p: PointerState, x: number, y: number, seconds: number): PointerState {
  if (!(seconds > 0)) {
    p.x = x;
    p.y = y;
    p.idle = 0;
    return p;
  }
  let sx = (x - p.x) / seconds;
  let sy = (y - p.y) / seconds;
  const speed = Math.hypot(sx, sy);
  if (speed > POINTER_MAX_SPEED) {
    sx = (sx / speed) * POINTER_MAX_SPEED;
    sy = (sy / speed) * POINTER_MAX_SPEED;
  }
  const a = POINTER_VELOCITY_SMOOTHING;
  p.vx += (sx - p.vx) * a;
  p.vy += (sy - p.vy) * a;
  p.x = x;
  p.y = y;
  p.idle = 0;
  return p;
}

/**
 * Advance a pointer's idle clock by `seconds` and decay its velocity once the silence passes
 * {@link POINTER_IDLE_SECONDS}. Called each frame by the field loop. The decay is proportional, so a
 * pointer that stops reporting fades its wake out over a few frames instead of cutting it dead.
 */
export function agePointer(p: PointerState, seconds: number): PointerState {
  if (!(seconds > 0)) return p;
  p.idle += seconds;
  if (p.idle > POINTER_IDLE_SECONDS) {
    const keep = Math.max(0, 1 - (p.idle - POINTER_IDLE_SECONDS) / POINTER_IDLE_SECONDS);
    p.vx *= keep;
    p.vy *= keep;
  }
  return p;
}

/**
 * The wake vector at `(px, py)` — how much of the pointer's motion matter there inherits, written
 * into a caller-owned `out` so the per-particle hot path allocates nothing.
 *
 * Three factors multiply, and each one is load-bearing:
 * - **distance**: linear falloff to zero at `radius` (the same shape as `flowBias`, so the two
 *   influences compose predictably when a host runs both).
 * - **speed**: scaled against {@link POINTER_REFERENCE_SPEED} and capped at 1. This is what makes a
 *   motionless cursor leave the field completely alone.
 * - **strength × gain**: the caller's dial and the field loop's unit conversion (px/second → the
 *   per-frame velocity the integrator speaks).
 */
export function pointerWakeInto(out: Vec2, px: number, py: number, p: PointerState, gain = 1): Vec2 {
  out.x = 0;
  out.y = 0;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed === 0) return out; // a still cursor is not a wake
  const dx = px - p.x;
  const dy = py - p.y;
  const d = Math.hypot(dx, dy);
  if (d >= p.radius) return out;
  const fall = 1 - d / p.radius;
  const speedScale = speed > POINTER_REFERENCE_SPEED ? 1 : speed / POINTER_REFERENCE_SPEED;
  const k = (fall * speedScale * p.strength * gain) / speed; // /speed normalizes (vx,vy) to a unit
  out.x = p.vx * k;
  out.y = p.vy * k;
  return out;
}

/** Allocating form of {@link pointerWakeInto}. */
export function pointerWake(px: number, py: number, p: PointerState, gain = 1): Vec2 {
  return pointerWakeInto({ x: 0, y: 0 }, px, py, p, gain);
}

// ── the throw ───────────────────────────────────────────────────────────────────────────────────

/** Ceiling on a fling (px/second). Same argument as {@link POINTER_MAX_SPEED}: a release velocity
 *  computed from a bad sample must not launch an element out of its own layout. */
export const FLING_MAX_SPEED = 3000;

/** The frame rate the element-offset integrator's per-frame velocities are expressed against. */
export const FLING_REFERENCE_FPS = 60;

/**
 * Convert a release velocity in **px/second** — what a host's own drag handler measures, and what
 * `PointerState` carries — into the **px/frame** the element-offset integrator speaks, clamped.
 *
 * The unit conversion is the entire function, and it is here rather than inline because getting it
 * wrong is invisible: an un-converted px/second value is 60× too large, which reads as "the throw
 * is broken" rather than "the units are wrong".
 */
export function flingVelocity(vx: number, vy: number, fps: number = FLING_REFERENCE_FPS): Vec2 {
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return { x: 0, y: 0 };
  let sx = vx;
  let sy = vy;
  const speed = Math.hypot(sx, sy);
  if (speed > FLING_MAX_SPEED) {
    sx = (sx / speed) * FLING_MAX_SPEED;
    sy = (sy / speed) * FLING_MAX_SPEED;
  }
  const f = fps > 0 ? fps : FLING_REFERENCE_FPS;
  return { x: sx / f, y: sy / f };
}
