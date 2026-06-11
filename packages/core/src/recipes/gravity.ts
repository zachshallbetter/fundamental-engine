/**
 * Gravity Field — gravity made into a *visible, followable* natural field. A `gravity` body is
 * already a real 1/d² law that radiates a monopole `field()` (matter falls along its radial lines);
 * this preset surfaces that structure — it traces the field lines and gives the well a light
 * tangential `swirl` so infalling matter threads the lines in orbit instead of dropping straight
 * in. The result reads like iron filings around a magnet: the natural-field look, on by intent.
 *
 * Experimental: lives beside the wayfinding pair in EXPERIMENTAL_RECIPES, outside the locked 64.
 * `gravity` and `swirl` stay their own force tokens; the compound only bundles them — no word
 * lives in two lanes.
 */
import type { FieldRecipe } from './schema.ts';

export const GRAVITY_FIELD: FieldRecipe = {
  id: 'gravity-field',
  name: 'Gravity Field',
  intent: 'show a gravity body as a visible, followable natural field — matter threads its lines in orbit',
  naturalField: 'gravity',
  status: 'experimental',
  primitives: ['gravity', 'swirl'],
  concepts: ['well', 'orbit', 'accretion', 'natural-field', 'field-lines'],
  conditions: [],
  bodies: [
    // one well carries both tokens: gravity is the real 1/d² law and radiates the monopole field
    // (the followable structure the field-lines reading traces); swirl adds a light tangential
    // component so infalling matter orbits along the lines rather than dropping straight to the core.
    { body: 'gravity swirl', strength: 1.2, range: 420, feedback: true },
  ],
  render: ['field-lines', 'particles'],
  metrics: ['density'],
  diagnostics: ['field-lines', 'inspector'],
  accessibility: {
    reducedMotion:
      'the field lines render statically and matter holds its orbit positions — the radial structure reads without any motion',
    meaningWithoutMotion:
      'the well is a labelled region with visible radial field lines; depth reads as line density, not animation',
  },
  notes:
    'Gravity already defines field() (the softened 1/d² monopole), so the field-lines reading traces its real radial structure — the seeds come from the body geometry (a core ring → spokes), never hand-drawn. The swirl token is what makes it read as a natural FIELD rather than a plain sink: matter threads the lines in orbit. Pair with the deformation grid (overlay "grid") to also show space bending into the well. Bare gravity stays an opt-in attractor; this preset is the natural-field presentation.',
};

/** The gravity presets — currently the one natural-field recipe. */
export const GRAVITY_RECIPES: readonly FieldRecipe[] = [GRAVITY_FIELD];
