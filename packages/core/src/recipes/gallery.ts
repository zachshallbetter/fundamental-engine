/**
 * The field-recipe gallery (authoring-and-recipes §7). Sixteen portable `FieldRecipe`s that map the
 * four-field translation model onto practical interface patterns. Each doubles as a worked example
 * and a conformance fixture: every force token is a real, passported force, every render layer +
 * diagnostic is a known mode, and the declared primitives match the body tokens — so `validateRecipe`
 * passes for all of them (the gallery test enforces this). Eight are the recommended first-release set
 * (see `FIRST_RELEASE_RECIPE_IDS`); the full sixteen give the system its range.
 *
 * These are classification + authoring artifacts. They compose existing primitives — they add no new
 * engine behavior.
 */
import type { FieldRecipe } from './schema.ts';

// ── Gravity: priority, convergence, hierarchy ───────────────────────────────────────

export const PRIORITY_WELL: FieldRecipe = {
  id: 'priority-well',
  name: 'Priority Well',
  intent: 'make important elements feel naturally weighted without shouting',
  naturalField: 'gravity',
  primitives: ['attract', 'gravity'],
  bodies: [
    { body: 'attract', strength: 1.2, range: 320, feedback: true },
    { body: 'gravity', strength: 0.6, range: 360 },
  ],
  render: ['particles', 'trails'],
  metrics: ['density', 'attention', 'priority'],
  diagnostics: ['potential', 'prediction', 'force-vectors'],
  accessibility: {
    reducedMotion: 'weight, glow, and the current-state marker hold their last value — no travel',
    meaningWithoutMotion: 'the important element is also stronger in weight, outline, and reading order',
  },
  notes: 'Gravity + attract pull matter and attention into one well; density writes back as --field-density, driving weight and bloom.',
};

export const FOCUS_ORBIT: FieldRecipe = {
  id: 'focus-orbit',
  name: 'Focus Orbit',
  intent: 'keep related options moving around the active item',
  naturalField: 'gravity',
  primitives: ['attract', 'magnetism', 'tether'],
  bodies: [
    { body: 'attract', strength: 1, range: 260, feedback: true },
    { body: 'magnetism', strength: 0.8, range: 300, spin: 1 },
    { body: 'tether', strength: 0.5, range: 220 },
  ],
  render: ['particles', 'field-lines'],
  metrics: ['attention', 'relation-strength'],
  diagnostics: ['prediction', 'topology', 'field-lines'],
  accessibility: {
    reducedMotion: 'a static relationship ring marks the active item; related items keep their weighted emphasis',
    meaningWithoutMotion: 'the active item is marked current; related items are listed beside it',
  },
  notes: 'The active item is a gravity well; magnetism curves the surrounding motion around it (gravity + electromagnetic), and tether keeps related options nearby.',
};

export const SEARCH_RELEVANCE_FIELD: FieldRecipe = {
  id: 'search-relevance-field',
  name: 'Search Relevance Field',
  intent: 'let search results settle by relevance, confidence, and recency',
  naturalField: 'gravity',
  primitives: ['attract', 'memory', 'repel'],
  bodies: [
    { body: 'attract', strength: 1, range: 280, feedback: true },
    { body: 'memory', strength: 0.6, range: 320 },
    { body: 'repel', strength: 0.5, range: 200 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['density', 'memory', 'recency'],
  diagnostics: ['potential', 'prediction', 'heatmap'],
  accessibility: {
    reducedMotion: 'results re-rank into a static ordered list; memory shows as a "seen" tick',
    meaningWithoutMotion: 'ranking is a numbered list; relevance and recency are labelled',
  },
  notes: 'Relevance becomes attract strength so confident results sink into deeper wells; weak results drift out (repel); previously opened results retain memory.',
};

// ── Electromagnetic: polarity, signal, flow, contrast ───────────────────────────────

export const SIGNAL_PATH: FieldRecipe = {
  id: 'signal-path',
  name: 'Signal Path',
  intent: 'show information flowing through citations, dependencies, or routes',
  naturalField: 'electromagnetic',
  primitives: ['charge', 'propagate', 'fieldflow'],
  bodies: [
    { body: 'charge', strength: 1, range: 300, spin: 1 },
    { body: 'propagate', strength: 0.8, range: 360 },
    { body: 'fieldflow', strength: 0.8, range: 0 },
  ],
  render: ['streamlines', 'field-lines', 'trails'],
  metrics: ['signal', 'strength'],
  diagnostics: ['field-lines', 'causality', 'force-vectors'],
  accessibility: {
    reducedMotion: 'a persistent path line with step markers replaces the travelling signal',
    meaningWithoutMotion: 'the route is also an ordered list of steps with a current-step state',
  },
  notes: 'A signal travels source → target along declared relationships: charge sets polarity, propagate carries the wave, fieldflow carries matter along the structure. Electric pushes, magnetic bends, fieldflow carries.',
};

export const EVIDENCE_FIELD: FieldRecipe = {
  id: 'evidence-field',
  name: 'Evidence Field',
  intent: 'show how sources support, weaken, or contradict a claim',
  naturalField: 'electromagnetic',
  primitives: ['charge', 'link', 'cohesion', 'repel'],
  bodies: [
    { body: 'charge', strength: 0.9, range: 280, spin: 1 },
    { body: 'link', strength: 0.7, range: 320 },
    { body: 'cohesion', strength: 0.6, range: 260, feedback: true },
    { body: 'repel', strength: 0.5, range: 200 },
  ],
  relationships: [{ from: 'claim', to: 'source', type: 'supports', strength: 0.7 }],
  render: ['links', 'particles', 'heatmap'],
  metrics: ['coherence', 'entropy'],
  diagnostics: ['topology', 'causality', 'links'],
  accessibility: {
    reducedMotion: 'a static claim/source table with support and conflict badges',
    meaningWithoutMotion: 'each source is listed as supporting or contradicting, with a confidence label',
  },
  notes: 'Claims are bodies; supporting sources bind them (link + cohesion), contradictory sources repel and raise entropy (electromagnetic + strong). Strong evidence increases coherence.',
};

export const CONFLICT_FIELD: FieldRecipe = {
  id: 'conflict-field',
  name: 'Conflict Field',
  intent: 'make contradiction, uncertainty, and unstable state visible',
  naturalField: 'weak',
  primitives: ['charge', 'repel', 'morph', 'diffuse'],
  bodies: [
    { body: 'charge', strength: 0.8, range: 260, spin: -1 },
    { body: 'repel', strength: 0.7, range: 220 },
    { body: 'morph', strength: 0.5, range: 240 },
    { body: 'diffuse', strength: 0.4, range: 240 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['conflict', 'entropy', 'coherence'],
  diagnostics: ['causality', 'contours', 'inspector'],
  accessibility: {
    reducedMotion: 'a static conflict rail lists contradictions and the fields they affect',
    meaningWithoutMotion: 'each contradiction is named with the states in conflict',
  },
  notes: 'Opposing states repel and raise entropy (electromagnetic); morph carries the transformation pressure toward resolution or a decayed warning (weak).',
};

// ── Strong: binding, cohesion, structure, clusters ──────────────────────────────────

export const RELATIONSHIP_BOND: FieldRecipe = {
  id: 'relationship-bond',
  name: 'Relationship Bond',
  intent: 'keep related elements visually and behaviorally connected',
  naturalField: 'strong',
  primitives: ['link', 'tether', 'cohesion'],
  bodies: [
    { body: 'link', strength: 0.8, range: 320, feedback: true },
    { body: 'tether', strength: 0.6, range: 240 },
    { body: 'cohesion', strength: 0.5, range: 260 },
  ],
  relationships: [{ from: 'a', to: 'b', type: 'related', strength: 0.6 }],
  render: ['links', 'particles'],
  metrics: ['relation-strength', 'tension'],
  diagnostics: ['topology', 'links', 'force-vectors'],
  accessibility: {
    reducedMotion: 'a static connector and a paired highlight stand in for the live bond',
    meaningWithoutMotion: 'related elements share a label/colour and are listed as connected',
  },
  notes: 'Related elements hold together through a bond with strength, tension, and memory — the strong force: binding and local structure.',
};

export const CONCEPT_CLUSTER: FieldRecipe = {
  id: 'concept-cluster',
  name: 'Concept Cluster',
  intent: 'group related terms, cards, or sections without hard layout changes',
  naturalField: 'strong',
  primitives: ['cohesion', 'crystallize', 'link', 'memory'],
  bodies: [
    { body: 'cohesion', strength: 0.7, range: 300, feedback: true },
    { body: 'crystallize', strength: 0.5, range: 260 },
    { body: 'link', strength: 0.5, range: 280 },
    { body: 'memory', strength: 0.4, range: 320 },
  ],
  render: ['metaballs', 'links', 'particles'],
  metrics: ['cluster', 'memory', 'density'],
  diagnostics: ['topology', 'heatmap', 'inspector'],
  accessibility: {
    reducedMotion: 'concepts collapse into grouped lists; active groups keep emphasis',
    meaningWithoutMotion: 'related concepts are grouped under headings with relation badges',
  },
  notes: 'Related concepts cluster without a rigid layout (cohesion + crystallize); active concepts strengthen nearby terms; unrelated ones cool and drift.',
};

export const COHERENCE_FIELD: FieldRecipe = {
  id: 'coherence-field',
  name: 'Coherence Field',
  intent: 'show whether a form, workflow, or dataset is becoming stable',
  naturalField: 'strong',
  primitives: ['cohesion', 'pressure', 'link', 'repel'],
  bodies: [
    { body: 'cohesion', strength: 0.7, range: 280, feedback: true },
    { body: 'pressure', strength: 0.5, range: 240 },
    { body: 'link', strength: 0.5, range: 260 },
    { body: 'repel', strength: 0.4, range: 180 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['coherence', 'entropy', 'pressure'],
  diagnostics: ['inspector', 'causality', 'heatmap'],
  accessibility: {
    reducedMotion: 'a static coherence/progress rail marks stable and unstable sections',
    meaningWithoutMotion: 'validity is announced and shown with icon + text per field',
  },
  notes: 'As valid pieces align, the field becomes more coherent (strong binding); missing or contradictory pieces raise pressure and entropy.',
};

// ── Gravity + memory + relationships: reading ───────────────────────────────────────

export const READING_FIELD: FieldRecipe = {
  id: 'reading-field',
  name: 'Reading Field',
  intent: 'make long content pages reveal attention, memory, and concept links',
  naturalField: 'gravity',
  primitives: ['attract', 'memory', 'link'],
  bodies: [
    { body: 'attract', strength: 0.8, range: 300, feedback: true },
    { body: 'memory', strength: 0.7, range: 360 },
    { body: 'link', strength: 0.5, range: 320 },
  ],
  relationships: [{ from: 'section', to: 'citation', type: 'cites', strength: 0.5 }],
  render: ['trails', 'links', 'particles'],
  metrics: ['attention', 'memory'],
  diagnostics: ['heatmap', 'topology', 'inspector'],
  accessibility: {
    reducedMotion: 'a memory-weighted table of contents and static section rails replace the live trail',
    meaningWithoutMotion: 'progress is a read-state marker; citations are listed inline',
  },
  notes: 'Sections near the viewport centre gain attention (gravity); dwelled sections accumulate memory; related concepts and citations light up through relationships. The flagship /docs/reading-field demo runs this on the production platform runtime.',
};

// ── Weak / metric: memory, decay, transformation ────────────────────────────────────

export const MEMORY_TRACE: FieldRecipe = {
  id: 'memory-trace',
  name: 'Memory Trace',
  intent: 'show where a user has been, paused, returned, or accumulated attention',
  naturalField: 'weak',
  primitives: ['memory', 'diffuse'],
  bodies: [
    { body: 'memory', strength: 0.8, range: 360, feedback: true },
    { body: 'diffuse', strength: 0.4, range: 280 },
  ],
  render: ['trails', 'heatmap', 'particles'],
  metrics: ['memory', 'recency', 'decay'],
  diagnostics: ['heatmap', 'contours', 'inspector'],
  accessibility: {
    reducedMotion: 'static history marks and recency labels replace the decaying trail',
    meaningWithoutMotion: 'visited items are marked with a timestamp / recency label',
  },
  notes: 'Interaction leaves a decaying trace (weak-force decay via memory); repeated interaction strengthens it; inactive traces cool over time.',
};

export const DECAY_NOTICE: FieldRecipe = {
  id: 'decay-notice',
  name: 'Decay Notice',
  intent: 'let stale, temporary, or completed state fade gracefully',
  naturalField: 'weak',
  primitives: ['morph', 'memory', 'diffuse'],
  bodies: [
    { body: 'morph', strength: 0.6, range: 240, feedback: true },
    { body: 'memory', strength: 0.5, range: 280 },
    { body: 'diffuse', strength: 0.4, range: 240 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['decay', 'age', 'heat'],
  diagnostics: ['inspector', 'heatmap', 'causality'],
  accessibility: {
    reducedMotion: 'a timestamp and a faded state marker replace the decay animation',
    meaningWithoutMotion: 'the state stays announced as text while emphasis fades',
  },
  notes: 'A state begins strong then naturally releases (weak force: expiration); the element stays semantically clear while visual emphasis decays.',
};

export const PHASE_SHIFT: FieldRecipe = {
  id: 'phase-shift',
  name: 'Phase Shift',
  intent: 'show a state transition: draft → published, pending → complete, hidden → active',
  naturalField: 'weak',
  primitives: ['morph', 'cohesion'],
  bodies: [
    { body: 'morph', strength: 0.7, range: 260, feedback: true },
    { body: 'cohesion', strength: 0.5, range: 240 },
  ],
  render: ['particles', 'metaballs'],
  metrics: ['phase', 'coherence', 'progress'],
  diagnostics: ['inspector', 'causality', 'prediction'],
  accessibility: {
    reducedMotion: 'a state label and progress marker replace the transition; non-motion styling shows the change',
    meaningWithoutMotion: 'the from/to state is named and announced on change',
  },
  notes: 'A body transitions between named states (weak-force transformation via morph); the interface shows continuity rather than replacement.',
};

// ── Electromagnetic + transport: flow ───────────────────────────────────────────────

export const GUIDED_FLOW: FieldRecipe = {
  id: 'guided-flow',
  name: 'Guided Flow',
  intent: 'move particles or attention along field lines, relationships, or paths',
  naturalField: 'electromagnetic',
  primitives: ['magnetism', 'fieldflow', 'stream', 'propagate'],
  bodies: [
    { body: 'magnetism', strength: 1, range: 420, spin: 1 },
    { body: 'fieldflow', strength: 0.8, range: 0 },
    { body: 'stream', strength: 0.6, range: 320, angle: 0 },
    { body: 'propagate', strength: 0.5, range: 300 },
  ],
  render: ['streamlines', 'field-lines', 'trails', 'particles'],
  metrics: ['flow', 'velocity', 'density'],
  diagnostics: ['field-lines', 'force-vectors', 'prediction'],
  accessibility: {
    reducedMotion: 'a static path contour with a numbered route and direction markers',
    meaningWithoutMotion: 'the route is an ordered list of steps with direction labels',
  },
  notes: 'Matter and attention move along field lines / relationship paths (electromagnetic + transport). Magnetism bends, fieldflow carries — the recipe-level expression of field.flowTo() and fieldflow.',
};

// ── Diagnostic + platform layers ────────────────────────────────────────────────────

export const DIAGNOSTIC_LENS: FieldRecipe = {
  id: 'diagnostic-lens',
  name: 'Diagnostic Lens',
  intent: 'reveal field lines, causality, prediction, topology, energy, and overlays',
  primitives: ['attract'],
  bodies: [{ body: 'attract', strength: 0.6, range: 260 }],
  render: ['particles', 'field-lines'],
  metrics: ['density', 'energy', 'entropy'],
  diagnostics: ['topology', 'inspector', 'causality', 'prediction', 'energy', 'potential', 'contours', 'force-vectors'],
  accessibility: {
    reducedMotion: 'a static inspector table and overlay toggles replace the live overlays',
    meaningWithoutMotion: 'every overlay has a textual table equivalent (counts, contributions, energy)',
  },
  notes: 'The lens reveals why something moved, where energy accumulated, which relationships are active, and which primitive caused the result. It reads diagnostics over any field rather than adding force.',
};

export const ACCESSIBILITY_EQUIVALENCE: FieldRecipe = {
  id: 'accessibility-equivalence',
  name: 'Accessibility Equivalence',
  intent: 'convert motion-heavy behavior into static, semantic, reduced-motion equivalents',
  primitives: ['attract'],
  bodies: [{ body: 'attract', strength: 0.8, range: 280, feedback: true }],
  render: ['particles'],
  metrics: ['attention', 'memory', 'coherence'],
  diagnostics: ['inspector'],
  accessibility: {
    reducedMotion: 'this recipe defines the equivalent: motion-heavy behavior maps to a static, semantic, reduced-motion form',
    meaningWithoutMotion: 'field visuals clarify state but are never the only source of meaning — semantics carry it',
  },
  notes: 'The contract recipe: any motion-heavy behavior must map to a semantic, static, reduced-motion equivalent. No field behavior may be the only source of meaning.',
};

/** The full field-recipe gallery (authoring §7), ordered by the four-field model. */
export const FIELD_RECIPES: readonly FieldRecipe[] = [
  PRIORITY_WELL,
  FOCUS_ORBIT,
  SEARCH_RELEVANCE_FIELD,
  SIGNAL_PATH,
  EVIDENCE_FIELD,
  CONFLICT_FIELD,
  RELATIONSHIP_BOND,
  CONCEPT_CLUSTER,
  COHERENCE_FIELD,
  READING_FIELD,
  MEMORY_TRACE,
  DECAY_NOTICE,
  PHASE_SHIFT,
  GUIDED_FLOW,
  DIAGNOSTIC_LENS,
  ACCESSIBILITY_EQUIVALENCE,
];

/** @deprecated renamed to {@link FIELD_RECIPES}. */
export const ESSENTIAL_RECIPES: readonly FieldRecipe[] = FIELD_RECIPES;

/**
 * The recommended first-release set: eight recipes that explain the system quickly and span the four
 * fields. The full sixteen give the project its range; these eight are the front door.
 */
export const FIRST_RELEASE_RECIPE_IDS: readonly string[] = [
  'priority-well',
  'signal-path',
  'relationship-bond',
  'reading-field',
  'evidence-field',
  'coherence-field',
  'memory-trace',
  'guided-flow',
];

/** The first-release recipes, resolved from {@link FIRST_RELEASE_RECIPE_IDS} in declared order. */
export const FIRST_RELEASE_RECIPES: readonly FieldRecipe[] = FIRST_RELEASE_RECIPE_IDS.map(
  (id) => FIELD_RECIPES.find((r) => r.id === id)!,
);

/** Look up a recipe by id (undefined if unknown). */
export function recipeById(id: string): FieldRecipe | undefined {
  return FIELD_RECIPES.find((r) => r.id === id);
}
