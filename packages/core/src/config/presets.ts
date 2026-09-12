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
 * scanner that consumes it. Entries use only *implemented* tokens — the canonical nine
 * (§6), the natural primitives (§20.10), and the designed-extended forces (§20.3, e.g.
 * `lens`, `buoyancy`, `spawn`, `warp`). Every token these entries name is implemented.
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
  /** lifespan (frames) of matter a class-[S] source emits — the `data-life` budget. */
  life?: number;
  /** max live particles a class-[S] source sustains — the `data-cap` budget. */
  cap?: number;
  /** `data-pair` — the partner selector for a `warp` throat. The sentinel `'@pair'` means
   *  "inherit the host element's own `data-pair`", so one preset serves both mouths. */
  pair?: string;
  /** `data-twist` — degrees of rotation applied to matter crossing a `warp` throat. */
  twist?: number;
  /** `data-scale` — scale applied to the relocated offset through a `warp` throat. */
  scale?: number;
  /** `data-when` — condition gate for this virtual body (§20.4), e.g. `'hot'`. */
  when?: string;
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
  // §20.9/§20.7 — two linked throats: `attract + warp(throat A) ⟷ warp + repel(throat B)`.
  //
  // The spec composition is ASYMMETRIC — the entry mouth draws matter in, the exit mouth
  // throws it clear — but a preset expands the same way on every element that carries it.
  // The asymmetry is recovered from the matter itself rather than from two preset tokens:
  // `warp` stamps `heat = 0.6` on everything it relocates (extended.ts), and the `hot` gate
  // is `heat > 0.3` (conditions.ts), so a `when: 'hot'` repel acts ONLY on matter that has
  // just come through the throat and is invisible to the cool matter falling in. One token,
  // both roles: cool matter sees `attract + warp` (mouth A), hot matter sees `warp + repel`
  // (mouth B). Heat decays at 0.972/frame, so the ejection window is ~24 frames — long
  // enough to clear the throat, short enough that the mouth becomes an attractor again.
  //
  // Without the repel the pair ping-pongs (measured: 489 throat crossings in 1200 frames),
  // because `warp` carries velocity through unrotated, so inbound matter emerges still
  // moving inward. The repel is what makes the composite TRANSPORT instead of trap.
  // Measured at these values: 8/8 particles transported, exactly one crossing each,
  // settling 274.7px clear of the throat (spec benchmark ≈245px), particle count conserved.
  //
  // Ships INERT: with no `data-pair` on the element, `@pair` resolves to nothing, `warp`
  // no-ops, and the hot gate never opens — the element is a plain attract well.
  wormhole: [
    { body: 'attract', strength: 0.9, range: 300 }, // draw matter into the throat
    { body: 'warp', absorb: 40, pair: '@pair', twist: 0, scale: 1 }, // relocate A→B (conserved)
    { body: 'repel', strength: 6, range: 200, when: 'hot' }, // the exit mouth: eject what arrives
  ],
  // §20.10 — hydrostatic equilibrium: gravity's collapse balanced by thermal pressure.
  // The same `gravity ⇄ thermal` fluctuation–dissipation balance that keeps the
  // resting field calm, scaled up. GM is large because true 1/d² is weak at UI scale.
  star: [
    { body: 'gravity', strength: 300, range: 320 }, // inward GM well
    { body: 'thermal', strength: 1.0, range: 220 }, // outward Brownian pressure
  ],
  // §20.9 — an accreting black hole that also jets along its poles.
  // attract is softened (0.7) so the jet nozzle speed (2.4 + 2.6·S) at S=2.5 → 8.9 px/frame
  // exceeds the escape velocity from the weakened well (~7 px/frame at d=50) — jets escape.
  quasar: [
    { body: 'attract', strength: 0.7, range: 340 }, // softened well — jets must escape it
    { body: 'swirl', strength: 1.2, range: 300, spin: 1 }, // accretion disk
    { body: 'sink', absorb: 40, max: 60 }, // horizon
    { body: 'lens', strength: 0.5, range: 380 }, // lensing
    { body: 'jet', strength: 2.5, range: 280, angle: -90 }, // north pole jet (fast enough to escape)
    { body: 'jet', strength: 2.5, range: 280, angle: 90 }, // south pole jet
  ],
  // A spiral disk: a soft well, a swirl for the arms, viscosity to settle into a plane,
  // and lensing at the rim. Attract is gentle (0.6) so swirl (1.3) dominates — spiral, not cluster.
  galaxy: [
    { body: 'attract', strength: 0.6, range: 400 }, // soft bulge — swirl must dominate
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
    // the explicit budget (life 90 = the source's historical lifespan, kept so the look is
    // unchanged) satisfies the [S] source-budget guard — presets always declare theirs.
    { body: 'spawn', strength: 1.2, angle: -90, life: 90 }, // jet up (−y); emits while on-screen
    { body: 'gravity', strength: 60, range: 0 }, // the arc home — global, weak
  ],
};
