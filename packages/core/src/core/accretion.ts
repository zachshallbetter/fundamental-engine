/**
 * Accretion — the pure, DOM-free core of the sink submodel (§6.9, agent-consumption-model).
 *
 * A `sink` captures matter into an accretion core, HOLDS it (the particle stays in the pool with
 * `cap = b`, drifting to the core in the integrator), and on saturation RELEASES exactly what it
 * held. This module owns the conserved release math and the capture/release event edge so both
 * `field.ts` (the impure shell that dispatches events + writes the DOM) and the conformance tests
 * exercise the *same* code. No DOM, no globals.
 */

import type { Body, Particle } from './types.ts';

/**
 * Release exactly the particles a body captured: reposition each at the core, give it a radial
 * outward velocity, clear its capture + heat to 1, and reset the body's load to 0. Held matter is
 * **conserved** — released particles stay in the caller's pool (never deleted), so `count` is
 * preserved. Returns the released particles (in pool order). `rng` is injectable for deterministic
 * tests; defaults to `Math.random`.
 */
export function releaseCaptured(
  particles: readonly Particle[],
  b: Body,
  rng: () => number = Math.random
): Particle[] {
  const released: Particle[] = [];
  for (const q of particles) {
    if (q.cap !== b) continue;
    const ang = rng() * Math.PI * 2;
    const spd = 4 + rng() * 3;
    q.cap = null;
    q.x = b.cx;
    q.y = b.cy;
    q.vx = Math.cos(ang) * spd;
    q.vy = Math.sin(ang) * spd;
    q.heat = 1;
    released.push(q);
  }
  b.accreted = 0;
  return released;
}

/** Sink fill fraction ∈ [0,1] — the value written to `--load` / `--mass`. 0 when not a sink. */
export function sinkLoad(b: Body): number {
  if (b.capacity <= 0) return 0;
  const f = b.accreted / b.capacity;
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/** The discrete capture/release event a sink crosses this frame, if any. */
export type CaptureEvent = 'captured' | 'released' | null;

/**
 * Capture/release event edge for a sink body. `prevArmed` is whether `captured` has fired since the
 * last release; `accreting` is `b.accreted > 0` after this frame's force pass. Rising edge →
 * `captured`; falling edge (which only happens via release/supernova, since load drops to 0 there)
 * → `released`. Pure: the caller persists `armed` and performs the dispatch.
 */
export function captureEdge(prevArmed: boolean, accreting: boolean): { fire: CaptureEvent; armed: boolean } {
  if (accreting && !prevArmed) return { fire: 'captured', armed: true };
  if (!accreting && prevArmed) return { fire: 'released', armed: false };
  return { fire: null, armed: prevArmed };
}
