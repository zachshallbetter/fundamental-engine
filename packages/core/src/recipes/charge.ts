/**
 * Contour Charge — the attention-charged vessel (#365). A text (or any) body pulls matter in while
 * it has attention, glows as the load rises, and DISCHARGES — releasing exactly what it held — the
 * moment attention leaves (the engine's attention-gated discharge, accretion.ts). The Contour Sink
 * tier supplies the visual: glyph-outline rings as the body's bound representation, thickening and
 * brightening from the mirrored `--load`.
 *
 * Naming: the recipe is `contour-charge`, never bare `charge` — `charge` is the electric force
 * token (signed ±, the Coulomb pair), and no word lives in two lanes. "Charge" here is the
 * colloquial charge-up/discharge cycle, carried safely inside the compound.
 *
 * Experimental: lives beside the wayfinding pair in EXPERIMENTAL_RECIPES, outside the locked 64.
 */
import type { FieldRecipe } from './schema.ts';

export const CONTOUR_CHARGE: FieldRecipe = {
  id: 'contour-charge',
  name: 'Contour Charge',
  intent: 'charge a body with gathered matter while it holds attention; discharge the moment attention leaves',
  naturalField: 'electromagnetic',
  status: 'experimental',
  primitives: ['sink', 'attract'],
  concepts: ['vessel', 'charge-up', 'discharge', 'glow', 'contour'],
  conditions: ['active'],
  bodies: [
    // one body carries both tokens: attract gathers, sink captures — both gated on engagement,
    // so the vessel only charges while attended. data-when='active' is what arms the engine's
    // falling-edge discharge.
    { body: 'sink attract', strength: 0.9, range: 300, feedback: true },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['density', 'load'],
  diagnostics: ['inspector', 'force-vectors'],
  accessibility: {
    reducedMotion: 'the glow tracks the static load value — no orbiting matter, no burst; the discharge reads as the glow returning to rest',
    meaningWithoutMotion: 'the vessel state is a number (--load) and a glow level; charged vs at-rest reads without any animation',
  },
  notes:
    'The charge cycle is conserved end to end: capture holds matter in the pool (it is not deleted), and the discharge is the same supernova release ritual as saturation — the same particles return to the field, with the field:released event on the body. Pair with the Contour Sink visual (contourSvgFor / data-field-visual-for + the platform mirroring) so the rings thicken with --load and flare on release. The body stays real text; the rings stay aria-hidden.',
};

/** The charge variations — currently the one vessel recipe. */
export const CHARGE_RECIPES: readonly FieldRecipe[] = [CONTOUR_CHARGE];
