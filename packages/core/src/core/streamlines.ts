/**
 * Streamlines / vector-field render (§20.6, diagnostic) — instead of the matter, draw
 * the *forces themselves*. At a grid of probe points we measure the net push a
 * still test particle would feel and draw a short arrow along it, so the invisible
 * field a layout creates becomes visible. Invaluable in the Lab: place forces, then
 * see the field they make.
 *
 * `forceAt` is pure and mirrors the integrator's body-force loop (same range cull),
 * minus the per-particle modifier pass — a faithful-enough probe for a diagnostic.
 */
import type { Body, Env, ForceRegistry, Particle } from './types.ts';

const probe: Particle = { x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null };

/** Net force a zero-velocity test particle would feel at (x, y) — the field vector.
 *  A force that defines a `field()` (its visual/structure field) contributes that instead
 *  of its `apply`, so velocity- and charge-dependent forces (magnetism, charge) appear here
 *  even though they no-op on a still, neutral probe. */
export function forceAt(
  bodies: readonly Body[],
  forces: ForceRegistry,
  env: Env,
  x: number,
  y: number,
): { fx: number; fy: number } {
  probe.x = x;
  probe.y = y;
  probe.vx = 0;
  probe.vy = 0;
  probe.heat = 0;
  let fxField = 0; // field() contributions, accumulated apart from the apply probe
  let fyField = 0;
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    const dx = b.cx - x;
    const dy = b.cy - y;
    const d2 = dx * dx + dy * dy;
    if (b.range > 0 && d2 >= b.range * b.range * 2.56) continue; // same cull as the integrator
    const d = Math.sqrt(d2);
    env.dx = dx;
    env.dy = dy;
    env.dist = d < 1 ? 1 : d;
    for (const tok of b.tokens) {
      const f = forces[tok];
      if (!f || f.modify) continue;
      if (f.field) {
        const v = f.field(b, x, y);
        fxField += v.x;
        fyField += v.y;
      } else {
        f.apply(b, probe, env);
      }
    }
  }
  return { fx: probe.vx + fxField, fy: probe.vy + fyField };
}
