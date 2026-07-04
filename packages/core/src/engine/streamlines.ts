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
    // mirror the integrator's shaped reference (§ Stage C): a shaped body warps the field from the
    // nearest point on its BOX, not its centre — so the grid / streamlines bend around an element's
    // whole outline (a button, a wide headline), not a single point. Clamp inlined (no alloc); inside
    // the box dx=dy=0 → no directional pull, the right no-op.
    let dx: number;
    let dy: number;
    if (b.shaped) {
      const lx = b.cx - b.hw;
      const rx = b.cx + b.hw;
      const ty = b.cy - b.hh;
      const by = b.cy + b.hh;
      dx = (x < lx ? lx : x > rx ? rx : x) - x;
      dy = (y < ty ? ty : y > by ? by : y) - y;
    } else {
      dx = b.cx - x;
      dy = b.cy - y;
    }
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

/** The net *structure* field at (x, y): the superposition of every visible body's `field()`
 *  contribution (the dipoles and monopoles only — no apply-probe), with the same range cull
 *  as the integrator. This is the field the streamlines view draws and the vector matter
 *  follows under `fieldflow`. Pure: same inputs, same output, no `env` mutation (the `field()`
 *  hooks read only `b` and the point, so it is safe to call mid-integration). */
export function netField(
  bodies: readonly Body[],
  forces: ForceRegistry,
  x: number,
  y: number,
): { x: number; y: number } {
  let fx = 0;
  let fy = 0;
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    if (b.range > 0) {
      const dx = b.cx - x;
      const dy = b.cy - y;
      if (dx * dx + dy * dy >= b.range * b.range * 2.56) continue; // same cull as the integrator
    }
    for (const tok of b.tokens) {
      const f = forces[tok];
      if (f?.field) {
        const v = f.field(b, x, y);
        fx += v.x;
        fy += v.y;
      }
    }
  }
  return { x: fx, y: fy };
}
