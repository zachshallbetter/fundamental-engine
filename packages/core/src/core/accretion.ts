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
 * Release exactly the particles a body captured: eject each just **past** the absorption radius
 * along a random bearing, give it a radial outward velocity, clear its capture + heat to 1, and
 * reset the body's load to 0. Held matter is **conserved** — released particles stay in the
 * caller's pool (never deleted), so `count` is preserved. Returns the released particles (in pool
 * order). `rng` is injectable for deterministic tests; defaults to `Math.random`.
 *
 * Ejecting past `absorbR` (rather than at the core) is what makes a supernova a real cycle. Matter
 * dropped at the core sits *inside* the capture radius and is re-grabbed on the very next frame,
 * degenerating the explosion into a per-frame strobe whose blast progressively evacuates the
 * catchment until the sink falls dormant. Leaving the accretion zone lets a `sink+attract` well
 * reel the ejecta back for a genuine fill → explode → fall-back → refill cycle (a lone `sink`
 * simply lets it disperse).
 */
export function releaseCaptured(
  particles: readonly Particle[],
  b: Body,
  rng: () => number = Math.random
): Particle[] {
  const released: Particle[] = [];
  const rim = b.absorbR + 6; // clear the capture horizon so it isn't re-captured next frame
  for (const q of particles) {
    if (q.cap !== b) continue;
    const ang = rng() * Math.PI * 2;
    const spd = 4 + rng() * 3;
    q.cap = null;
    q.x = b.cx + Math.cos(ang) * rim;
    q.y = b.cy + Math.sin(ang) * rim;
    q.vx = Math.cos(ang) * spd;
    q.vy = Math.sin(ang) * spd;
    q.heat = 1;
    // A supernova is a CONSERVATION event: the ejected matter rejoins the PERSISTENT
    // field. Mortal (class-[S] source-spawned) matter that a sink captured and held is
    // released immortal — so a source→sink→supernova loop visibly conserves (the matter
    // the source made becomes lasting field matter, bounded by the engine's pool ceiling)
    // instead of the released particles aging out and vanishing moments after release. A
    // no-op for the conserved base pool (age already undefined), so the canonical sink —
    // captured base particles return exactly as before — is unchanged.
    q.age = undefined;
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

/**
 * Attention-gated discharge (#365, the Contour Charge behavior): a sink gated on engagement
 * (`data-when="active"`) releases what it holds on the FALLING edge of engagement — the vessel
 * charges while attended and discharges when attention leaves. The condition pass already gates
 * capture (a closed gate pulls nothing new in); this is the matching release side. Pure trigger:
 * the caller supplies the release ritual (the engine passes `env.supernova`, so discharge is the
 * same conserved release — same radial burst, same `field:released` event — as saturation).
 * Returns the bodies that discharged this pass.
 */
export function dischargeDisengaged(bodies: readonly Body[], release: (b: Body) => void): Body[] {
  const discharged: Body[] = [];
  for (const b of bodies) {
    if (b.when !== 'active' || !b.tokens.includes('sink')) continue;
    if (b.wasOn && !b.on && b.accreted > 0) {
      release(b);
      discharged.push(b);
    }
    b.wasOn = b.on;
  }
  return discharged;
}
