/**
 * The Wayfinding Field — two experimental `FieldRecipe`s that turn site navigation chrome into a
 * member of the invisible-fields family: the nav's destinations become bodies, and the engine runs
 * signals-only (`render: []`) to write CSS custom properties back onto the links. Nothing is drawn;
 * the only visible thing is the consequence — destinations surfacing and receding. Progressive
 * enhancement: with the engine off (or under reduced motion) the nav degrades to plain, reachable
 * links with a labelled current state.
 *
 * Two distinct variations — by natural field, and by which wayfinding question they answer
 * (the canonical "where am I / where can I go / where have I been", reading-field §):
 *   • Wayfinding Field (gravity)           — "where am I, what's adjacent" (present-tense orientation).
 *   • Wayfinding Current (electromagnetic)  — "where have I been" (the path travelled, the current from home).
 *
 * Both pass `validateRecipe` (real passported tokens, known render layers + diagnostics, primitives =
 * body tokens, a fundamental field, a reduced-motion equivalent). They are kept OUT of the canonical
 * 64-recipe `FIELD_RECIPES` catalog (a locked 4×16 of shipped recipes, cited as such across the
 * papers) and marked `experimental` — they surface on the /recipes hub as a labelled experimental
 * group, not folded into the canon.
 */
import type { FieldRecipe } from './schema.ts';

/**
 * Variation 1 — orientation by proximity. The current route is a gravity well; conserved attention
 * brightens the destinations nearest it while the rest recede, and `cohesion` writes back
 * `--field-coherence` so adjacency surfaces. The signature visual is a field-line traced from the
 * wordmark (home) to the current destination.
 */
export const WAYFINDING_FIELD: FieldRecipe = {
  id: 'wayfinding-field',
  name: 'Wayfinding Field',
  intent: 'orient the visitor in a navigation bar by surfacing where they are and what is adjacent',
  naturalField: 'gravity',
  status: 'experimental',
  primitives: ['attract', 'tether', 'cohesion'],
  concepts: ['wayfinding', 'orientation'],
  conditions: ['in-view', 'focused'],
  bodies: [
    // the current route is the well — attention (conserved) pools toward it
    { body: 'attract', strength: 1.1, range: 300, feedback: true },
    // related destinations stay bound nearby rather than drifting off
    { body: 'tether', strength: 0.6, range: 240 },
    // coherence to the current route, written back as --field-coherence
    { body: 'cohesion', strength: 0.5, range: 260, feedback: true },
  ],
  render: ['field-lines', 'heatmap'],
  metrics: ['attention', 'coherence', 'priority'],
  diagnostics: ['topology', 'field-lines', 'inspector'],
  accessibility: {
    reducedMotion:
      'the current destination holds aria-current with a static underline; link weights stop travelling',
    meaningWithoutMotion:
      'links keep reading order and a labelled current state; adjacency reads as a visible grouping',
  },
  notes:
    'Applied signals-only (render: []) over the nav: the simulation and feedback run, no canvas is drawn, and the only output is CSS custom properties on the links. The current route is a gravity well; conserved attention brightens the destinations nearest it while the rest recede; cohesion writes --field-coherence so adjacency surfaces. The declared render layers (field-lines, heatmap) are the visual vocabulary when the field is drawn — e.g. a field-line traced wordmark → current destination.',
};

/**
 * Variation 2 — the journey. A current propagates from the wordmark (home/source) toward the current
 * route along the nav's structure (`fieldflow`); visited destinations sink matter into a faint wake
 * (the Sink/Accretion model) that `memory` holds across client-side navigation, riding along on the
 * persisted field-root.
 */
export const WAYFINDING_CURRENT: FieldRecipe = {
  id: 'wayfinding-current',
  name: 'Wayfinding Current',
  intent: 'trace the path a visitor has travelled and the current flowing from home to where they are',
  naturalField: 'electromagnetic',
  status: 'experimental',
  primitives: ['propagate', 'fieldflow', 'sink', 'memory'],
  concepts: ['wake', 'trail', 'provenance', 'accretion'],
  conditions: ['return', 'related'],
  bodies: [
    // the signal travelling home → current route
    { body: 'propagate', strength: 0.9, range: 360, feedback: true },
    // carries the flow along the nav structure (transport, not a push — range 0)
    { body: 'fieldflow', strength: 0.8, range: 0 },
    // visited destinations sink matter into a wake (Sink/Accretion)
    { body: 'sink', strength: 0.5, range: 240 },
    // memory holds the visited trail across navigation
    { body: 'memory', strength: 0.6, range: 280 },
  ],
  render: ['streamlines', 'heatmap', 'field-lines'],
  metrics: ['signal', 'recency', 'memory'],
  diagnostics: ['causality', 'field-lines', 'inspector'],
  accessibility: {
    reducedMotion:
      'visited destinations get a static "seen" tick and the path reads as a breadcrumb — no travelling current',
    meaningWithoutMotion:
      'the journey is a breadcrumb list home → current; visited links are labelled seen',
  },
  notes:
    'Applied signals-only over the nav. A current propagates from the wordmark (home/source) toward the current route along the nav structure (fieldflow carries, it does not push); visited destinations sink matter into a faint wake that memory holds across client-side navigation, riding on the persisted field-root. The declared render layers (streamlines, heatmap, field-lines) are the visual vocabulary when drawn.',
};

/** The Wayfinding Field variations — experimental nav-chrome recipes, not part of `FIELD_RECIPES`. */
export const WAYFINDING_RECIPES: readonly FieldRecipe[] = [WAYFINDING_FIELD, WAYFINDING_CURRENT];

import { CHARGE_RECIPES } from './charge.ts';
import { GRAVITY_RECIPES } from './gravity.ts';

/** Experimental patterns surfaced on the /recipes hub outside the canonical 64. */
export const EXPERIMENTAL_PATTERNS: readonly FieldRecipe[] = [
  ...WAYFINDING_RECIPES,
  ...CHARGE_RECIPES,
  ...GRAVITY_RECIPES,
];

/** @deprecated Renamed to {@link EXPERIMENTAL_PATTERNS} (recipe → Pattern); removed at 1.0. */
export const EXPERIMENTAL_RECIPES = EXPERIMENTAL_PATTERNS;
