/**
 * Formation helpers (§7). A formation is a global bias on every free particle;
 * the engine eases the active preset toward its target each frame so transitions
 * glide rather than snap.
 */

import type { Body, Formation } from './types.ts';

/** Ease `current` toward `target` in place, per term (lerp `rate`/frame, §7). */
export function easeFormation(current: Formation, target: Formation, rate = 0.03): void {
  current.driftX += (target.driftX - current.driftX) * rate;
  current.wander += (target.wander - current.wander) * rate;
  current.orbit += (target.orbit - current.orbit) * rate;
  current.spread += (target.spread - current.spread) * rate;
  current.conv += (target.conv - current.conv) * rate;
}

/** The accretion target for `conv` — the first visible body that absorbs (§7). */
export function accretionTarget(bodies: readonly Body[]): Body | null {
  for (const b of bodies) {
    if (b.vis && b.tokens.indexOf('absorb') >= 0) return b;
  }
  return null;
}
