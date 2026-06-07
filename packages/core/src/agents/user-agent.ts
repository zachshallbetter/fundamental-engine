/**
 * UserAgent (system-contracts §8) — user input as field participation. The pointer is a wake, the
 * focused element a first-class attention source, the selection a capture, scroll a current. It
 * must respect reduced motion, keyboard accessibility, pointer absence, and touch.
 *
 * Pure state + update so it is node-testable; the engine feeds it raw input and reads the resulting
 * field source. Under reduced motion, travel-heavy response is suppressed: the pointer wake stops
 * but focus still produces an accessible (static) attention source.
 */

export interface UserAgentState {
  /** pointer position in field space; null when the pointer is absent. */
  px: number | null;
  py: number | null;
  /** pointer velocity (px/tick), eased. */
  vx: number;
  vy: number;
  /** id of the focused body, or null. */
  focusId: string | null;
  /** id of the selected/captured body, or null. */
  selectionId: string | null;
  /** eased scroll speed (a current). */
  scrollV: number;
  /** honor prefers-reduced-motion — suppress travel-heavy response. */
  reducedMotion: boolean;
}

export function createUserAgent(reducedMotion = false): UserAgentState {
  return { px: null, py: null, vx: 0, vy: 0, focusId: null, selectionId: null, scrollV: 0, reducedMotion };
}

export interface UserInput {
  pointer?: { x: number; y: number } | null;
  focusId?: string | null;
  selectionId?: string | null;
  scrollV?: number;
}

const ease = (cur: number, next: number, k: number): number => cur + (next - cur) * k;

/** Advance the UserAgent from one input frame. Pure (mutates and returns the state). */
export function updateUserAgent(u: UserAgentState, input: UserInput, ease_k = 0.3): UserAgentState {
  if ('pointer' in input) {
    const p = input.pointer ?? null;
    if (p && u.px != null && u.py != null) {
      u.vx = ease(u.vx, p.x - u.px, ease_k);
      u.vy = ease(u.vy, p.y - u.py, ease_k);
    } else {
      u.vx = 0;
      u.vy = 0;
    }
    u.px = p ? p.x : null;
    u.py = p ? p.y : null;
  }
  if ('focusId' in input) u.focusId = input.focusId ?? null;
  if ('selectionId' in input) u.selectionId = input.selectionId ?? null;
  if (input.scrollV != null) u.scrollV = ease(u.scrollV, input.scrollV, ease_k);
  return u;
}

/**
 * The field source the UserAgent projects, after accessibility gating. Under reduced motion the
 * pointer wake (a moving source) is dropped, but a focused element still yields a static attention
 * source — so meaning survives without motion (the §8 / Accessibility Contract rule).
 */
export interface UserFieldSource {
  /** a moving pointer wake, if active and motion is allowed. */
  wake: { x: number; y: number; vx: number; vy: number } | null;
  /** an accessible attention source from focus (present even under reduced motion). */
  focus: string | null;
  /** a capture from selection. */
  capture: string | null;
}

export function userFieldSource(u: UserAgentState): UserFieldSource {
  const moving = u.px != null && u.py != null && (Math.abs(u.vx) > 0.01 || Math.abs(u.vy) > 0.01);
  return {
    wake: !u.reducedMotion && moving ? { x: u.px!, y: u.py!, vx: u.vx, vy: u.vy } : null,
    focus: u.focusId,
    capture: u.selectionId,
  };
}
