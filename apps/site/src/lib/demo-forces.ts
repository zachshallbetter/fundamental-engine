/**
 * The single source of truth for the home page's force-demo attributes.
 *
 * Both the live chips (`index.astro`) and the field-line verification
 * (`field-probe.test.ts`) read these, so the traced path is provably the same force the
 * on-screen particles feel. Change a demo's strength/range here and both move together.
 */
import { MANUAL_FORCES } from '@field-ui/core';
import type { ProbeOverride } from './field-probe.ts';

/** Base attributes every natural/extended demo body carries unless overridden. */
export const DEFAULTS = { strength: 1.5, range: 280, spin: 1, angle: -90 } as const;

/** Per-force tuning so each demo visibly exhibits its characteristic behavior. */
export const OVERRIDES: Record<string, Record<string, number>> = {
  gravity: { strength: 320, range: 360 },
  thermal: { strength: 1.5, range: 240 },
  magnetism: { strength: 0.15, range: 180 }, // tight range concentrates cyclotron arcs
  charge: { strength: 80 }, // M=80 → visible +/- demixing
  memory: { strength: 2.5 },
  wind: { strength: 26 }, // curl-noise is divergence-free + WIND_SCALE 0.01 → needs amplitude to drift
  lens: { strength: 0.2 }, // a gentle caustic bend (~2.5rad arc); higher over-rotates into full loops
};

/** Forces that need sibling tokens beyond their own name for a legible demo. Modifiers
 *  (resonate, spotlight) genuinely require a sibling — they have no force of their own and
 *  exist to modify one. So does fieldflow: it advects matter along the NET field other
 *  forces radiate (their `field()` hooks), so without a field-radiating sibling there are
 *  no lines to follow and the body is a no-op. A real force like magnetism does NOT: its
 *  dipole field-line render plus the field's charge induction make it legible on its own,
 *  so pairing it with attract would just make the demo do two things at once. */
export const BODY_TOKENS: Record<string, string> = {
  resonate: 'resonate attract', // modifier — pulses a sibling; pair with attract
  spotlight: 'spotlight stream', // modifier — gates a sibling to a cone; pair with stream
  fieldflow: 'fieldflow magnetism', // transport — needs a radiated field; thread a magnet's dipole loops
};

/** The natural/extended demo attrs: DEFAULTS, with any OVERRIDES and sibling tokens merged. */
export const attrsFor = (t: string): { strength: number; range: number; spin: number; angle: number } => ({
  strength: DEFAULTS.strength,
  range: DEFAULTS.range,
  spin: DEFAULTS.spin,
  angle: DEFAULTS.angle,
  ...(OVERRIDES[t] ?? {}),
});

/** The canonical nine: hardcoded chips in index.astro — mirror their `data-*` exactly. */
const CANONICAL: Record<string, ProbeOverride> = {
  attract: { tokens: ['attract'], strength: 1, range: 300 },
  repel: { tokens: ['repel'], strength: 1.1, range: 300 },
  swirl: { tokens: ['swirl'], strength: 1, range: 320, spin: 1 },
  stream: { tokens: ['stream'], strength: 1, range: 340, angleDeg: 0 },
  viscosity: { tokens: ['viscosity'], strength: 1, range: 300 },
  jet: { tokens: ['jet'], strength: 1, range: 300, angleDeg: 0 },
  tether: { tokens: ['tether'], strength: 1, range: 260 },
  wall: { tokens: ['wall'] },
  sink: { tokens: ['sink', 'attract'], strength: 0.8, range: 180 },
};

/** The full effective demo attrs for every force token, as the live chip renders them. */
export const DEMO_OVERRIDES: Record<string, ProbeOverride> = (() => {
  const m: Record<string, ProbeOverride> = { ...CANONICAL };
  for (const f of MANUAL_FORCES) {
    if (f.family !== 'natural' && f.family !== 'extended') continue;
    const a = attrsFor(f.token);
    m[f.token] = {
      tokens: (BODY_TOKENS[f.token] ?? f.token).split(/\s+/),
      strength: a.strength,
      range: a.range,
      spin: a.spin,
      angleDeg: a.angle,
    };
  }
  return m;
})();
