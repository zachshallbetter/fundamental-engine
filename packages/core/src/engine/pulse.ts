/**
 * Transient per-body flare (#567) — the decaying one-shot a body takes on an *occurrence*, kept
 * apart from the continuous channels the field measures every frame.
 *
 * The gap this fills: `--d` is a *measurement* (how much matter is gathered on this body right
 * now), and it is the wrong place to put "this just completed". Consumers who wanted the second
 * thing wrote it into the first — the CAPMPrep integration drove `--d` from its own 60fps rAF
 * loop, which meant the app was writing the channel the engine owns, fighting the eased density
 * the engine was writing into the same property. `--field-pulse` is a separate channel, so a
 * flare and a gathering never overwrite each other.
 *
 * `burst(x, y)` is not this. A burst is a *render-surface* effect at screen coordinates — it
 * shoves and heats matter. A pulse touches no matter at all; it is a reading on one body.
 *
 * Pure math here. The state lives on the Body and the decay is stepped in the field loop.
 */

/**
 * Seconds for a flare to fall to half. 0.15s puts a full-energy pulse under 5% in ~0.65s — the
 * ~0.6s decay hand-rolled consumers converged on independently, which is about as long as a
 * completion flare can hold before it reads as a stuck highlight rather than an event.
 */
export const PULSE_HALF_LIFE = 0.15;

/**
 * Below this the flare is over: the field writes one final exact `0` (so a consumer's CSS lands
 * on rest rather than on 0.0004) and the body leaves the pulse path entirely until pulsed again.
 */
export const PULSE_FLOOR = 0.0005;

/**
 * Add `energy` to a body's live flare, saturating at 1. Additive so a rapid double-event reads as
 * *more*, clamped so the channel keeps the [0,1] contract every other feedback channel holds — an
 * author styling `calc(var(--field-pulse) * 12px)` can size against a known ceiling. Negative or
 * non-finite energy contributes nothing (it cannot be used to cancel a flare in flight).
 */
export function pulseAdd(level: number, energy: number): number {
  if (!Number.isFinite(energy) || energy <= 0) return level;
  const next = level + energy;
  return next > 1 ? 1 : next;
}

/**
 * Exponential decay over `seconds` of WALL time. Wall time, not the motion budget: a flare is a
 * transient reading, and a reading that cannot decay is a stuck instrument, not a still one. A
 * reduced-motion field (`dt === 0`) is frozen — no matter moves — and its flares still resolve to
 * rest instead of latching on forever.
 */
export function pulseDecay(level: number, seconds: number, halfLife: number = PULSE_HALF_LIFE): number {
  if (!(seconds > 0) || !(halfLife > 0)) return level;
  return level * Math.pow(2, -seconds / halfLife);
}
