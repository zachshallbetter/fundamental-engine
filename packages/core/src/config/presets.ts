/**
 * The preset layer (§20.9) — cosmology as *named arrangements of primitives*, not
 * new force modules.
 *
 * An element with `data-preset="blackhole"` expands into several **co-located virtual
 * bodies**, each a single primitive with its *own* attrs, all bound to the same rect.
 * This solves the one blocker the spec calls out: a plain `data-body="attract swirl
 * sink"` shares one strength/range across every token, so the horizon (`sink`)
 * can't be tuned independently of the well (`attract`). A preset gives each primitive
 * its own parameters.
 *
 * The force loop is unchanged — it already iterates `bodies × tokens` (§4); the
 * scanner just emits more bodies (`scanner.ts` → `expandPreset`). Presets are opt-in:
 * a page using `data-body` is entirely unaffected.
 *
 * This file is pure data (no imports), so it can't create an import cycle with the
 * scanner that consumes it. Entries use only *implemented* tokens — the canonical
 * nine (§6) plus the natural primitives (§20.10: gravity/charge/magnetism/thermal).
 * Composites that need the not-yet-built atoms (`lens`/`warp`/`spawn`/`resonate`/
 * `spotlight`) are deferred until those land.
 */

/** One virtual body in a preset — a single primitive with its own parameters (§20.9). */
export interface PresetEntry {
  /** the primitive token this virtual body runs (a single force). */
  body: string;
  /** force magnitude S (and, for gravity/charge, the source scalar GM). */
  strength?: number;
  /** influence radius, px. */
  range?: number;
  /** swirl/charge/magnetism sign or spin (±). */
  spin?: number;
  /** heading in degrees, for stream/jet. */
  angle?: number;
  /** capture radius, for sink. */
  absorb?: number;
  /** load at which a sink supernovas. */
  max?: number;
}

/**
 * The preset table (§20.9 composite map). Tunable starting points — refine when each
 * is actually demoed, since these never touch the live site until opted into.
 */
export const PRESETS: Record<string, readonly PresetEntry[]> = {
  // §20.9 designed composite — well + frame-drag + horizon + grazing-path bending.
  blackhole: [
    { body: 'attract', strength: 1.4, range: 340 }, // the well
    { body: 'swirl', strength: 1.0, range: 300, spin: 1 }, // frame-drag → accretion disk
    { body: 'sink', absorb: 42, max: 60 }, // event horizon: capture → supernova
    { body: 'lens', strength: 0.5, range: 380 }, // gravitational lensing of passing matter
  ],
  // §20.9 — the time-reverse: an emission horizon that throws matter out.
  whitehole: [
    { body: 'repel', strength: 1.4, range: 340 },
    { body: 'stream', strength: 0.6, range: 300, angle: 0 }, // optional directed eject
  ],
  // §20.10 — hydrostatic equilibrium: gravity's collapse balanced by thermal pressure.
  // The same `gravity ⇄ thermal` fluctuation–dissipation balance that keeps the
  // resting field calm, scaled up. GM is large because true 1/d² is weak at UI scale.
  star: [
    { body: 'gravity', strength: 300, range: 320 }, // inward GM well
    { body: 'thermal', strength: 1.0, range: 220 }, // outward Brownian pressure
  ],
  // §20.9 — an accreting black hole that also jets along its poles.
  quasar: [
    { body: 'attract', strength: 1.4, range: 340 }, // the well
    { body: 'swirl', strength: 1.2, range: 300, spin: 1 }, // accretion disk
    { body: 'sink', absorb: 40, max: 60 }, // horizon
    { body: 'lens', strength: 0.5, range: 380 }, // lensing
    { body: 'jet', strength: 1.2, range: 260, angle: -90 }, // north pole jet
    { body: 'jet', strength: 1.2, range: 260, angle: 90 }, // south pole jet
  ],
  // A spiral disk: a soft well, a swirl for the arms, viscosity to settle into a plane,
  // and lensing at the rim.
  galaxy: [
    { body: 'attract', strength: 1.0, range: 400 }, // the bulge
    { body: 'swirl', strength: 1.3, range: 380, spin: 1 }, // spiral arms
    { body: 'viscosity', strength: 0.4, range: 400 }, // settle into the disk
    { body: 'lens', strength: 0.3, range: 420 }, // halo lensing
  ],
  // A warm, slow cloud: thermal agitation churning in a viscous medium, light matter
  // drifting up.
  nebula: [
    { body: 'thermal', strength: 0.8, range: 320 }, // warm churn
    { body: 'viscosity', strength: 0.5, range: 320 }, // viscous medium
    { body: 'buoyancy', strength: 0.3, range: 0 }, // light wisps rise
  ],
  // A swirl with an updraft along its axis, calmed at the edges by viscosity.
  tornado: [
    { body: 'swirl', strength: 1.6, range: 300, spin: 1 }, // the funnel
    { body: 'stream', strength: 0.8, range: 280, angle: -90 }, // updraft
    { body: 'viscosity', strength: 0.3, range: 300 }, // ragged edge
  ],
  // §20.2 — a continuous class-[S] source jetting matter upward, the spray pulled back
  // down by a gentle global gravity well: a literal water fountain.
  fountain: [
    { body: 'spawn', strength: 1.2, angle: -90 }, // jet up (−y); emits while on-screen
    { body: 'gravity', strength: 60, range: 0 }, // the arc home — global, weak
  ],
};
