/**
 * The field-recipe catalog (authoring-and-recipes §7) — the data file for the 64 portable
 * `FieldRecipe`s that map the four-field translation model onto practical interface patterns, grouped
 * into four tiers (`RECIPE_TIERS`). Each doubles as a worked example and a conformance fixture: every
 * runtime token is a real passported force, every render layer + diagnostic is a known mode, the
 * declared primitives match the body tokens, and no primitive is a diagnostic/metric/concept/condition
 * — so `validateRecipe` passes for all of them (the conformance test enforces this).
 *
 * Lanes are kept separate: `primitives` are strict runtime tokens; `concepts`/`conditions` (layered in
 * by id below) are product language and activation logic; `metrics`/`diagnostics` are measured state
 * and inspection modes. These are classification + authoring artifacts — they compose existing
 * primitives and add NO new engine behavior. Eight ids are the recommended first-release set.
 */
import type { FieldRecipe, RecipeTier } from './schema.ts';

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

/** Tier 1 — core interface + accessibility fields (recipes 1-16). */
const TIER_CORE: readonly FieldRecipe[] = [
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

/**
 * Tier 2 — product, workflow, trust, collaboration (recipes 17-32). Applied product patterns built
 * from the same primitives as the core tier.
 */
const TIER_PRODUCT: readonly FieldRecipe[] = [
  {
    id: 'attention-weather',
    name: 'Attention Weather',
    intent: 'show system urgency, density, and activity across a dashboard',
    naturalField: 'gravity',
    primitives: ['gravity', 'thermal', 'pressure', 'diffuse', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1, range: 380, feedback: true },
      { body: 'thermal', strength: 0.8, range: 320 },
      { body: 'pressure', strength: 0.7, range: 300 },
      { body: 'diffuse memory', strength: 0.5, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'particles'],
    metrics: ['heat', 'pressure', 'attention', 'density'],
    diagnostics: ['heatmap', 'energy', 'contours', 'inspector'],
    accessibility: {
      reducedMotion: 'a status rail with a pressure badge per section and a priority-ordered list',
      meaningWithoutMotion: 'section tone, a numeric pressure badge, and priority ordering carry urgency without animation',
    },
    notes: 'Mass falls toward what matters and heat rises where the system runs hot — gravitational priority and thermal weather translated to a dashboard.',
  },
  {
    id: 'navigation-current',
    name: 'Navigation Current',
    intent: 'make routes, breadcrumbs, and likely next paths feel connected',
    naturalField: 'electromagnetic',
    primitives: ['fieldflow', 'stream', 'memory', 'propagate', 'link'],
    bodies: [
      { body: 'fieldflow', strength: 0.9, range: 0, feedback: true },
      { body: 'stream', strength: 0.7, range: 340, angle: 0 },
      { body: 'memory', strength: 0.5, range: 280 },
      { body: 'propagate link', strength: 0.5, range: 300 },
    ],
    render: ['streamlines', 'field-lines', 'links', 'trails', 'particles'],
    metrics: ['current', 'memory', 'signal', 'route-strength'],
    diagnostics: ['field-lines', 'force-vectors', 'topology'],
    accessibility: {
      reducedMotion: 'an active-path rail with visited markers and next-step hints',
      meaningWithoutMotion: 'the route reads as an ordered breadcrumb list with visited and next-step labels',
    },
    notes: 'Magnetism bends the route, fieldflow carries the traveller along it — the active path emits a current while prior routes linger as memory.',
  },
  {
    id: 'citation-thread',
    name: 'Citation Thread',
    intent: 'bind citations, footnotes, evidence, references into visible relationships',
    naturalField: 'electromagnetic',
    primitives: ['link', 'fieldflow', 'charge', 'memory'],
    bodies: [
      { body: 'link', strength: 1, range: 360, feedback: true },
      { body: 'fieldflow', strength: 0.7, range: 0 },
      { body: 'charge', strength: 0.6, range: 300, spin: 1 },
      { body: 'memory', strength: 0.5, range: 260 },
    ],
    relationships: [{ from: 'citation', to: 'source', type: 'cites', strength: 0.9 }],
    render: ['links', 'field-lines', 'trails', 'particles'],
    metrics: ['relation-strength', 'confidence', 'memory'],
    diagnostics: ['topology', 'causality', 'inspector'],
    accessibility: {
      reducedMotion: 'persistent source highlights with numbered source links and support badges',
      meaningWithoutMotion: 'each claim names its source via a numbered link and a support badge, no thread animation needed',
    },
    notes: 'Charge binds a citation to its source and fieldflow carries the eye down the thread — electromagnetic relation made readable from either end.',
  },
  {
    id: 'form-stability-field',
    name: 'Form Stability Field',
    intent: 'show validation as coherence instead of error noise',
    naturalField: 'strong',
    primitives: ['cohesion', 'pressure', 'morph', 'memory', 'link'],
    bodies: [
      { body: 'cohesion', strength: 1, range: 320, feedback: true },
      { body: 'pressure', strength: 0.7, range: 280 },
      { body: 'morph memory', strength: 0.5, range: 260 },
      { body: 'link', strength: 0.6, range: 300 },
    ],
    render: ['metaballs', 'links', 'particles'],
    metrics: ['coherence', 'entropy', 'pressure', 'completion'],
    diagnostics: ['inspector', 'causality', 'topology'],
    accessibility: {
      reducedMotion: 'a coherence meter with grouped validation messages and stable/unstable markers',
      meaningWithoutMotion: 'a coherence meter and per-group stable/unstable markers report validity without motion',
    },
    notes: 'The strong force binds valid fields into one coherent body while contradiction raises pressure — weak-style decay (morph) releases the tension as completion settles in.',
  },
  {
    id: 'command-intent-field',
    name: 'Command Intent Field',
    intent: 'let command palettes settle around likely intent',
    naturalField: 'gravity',
    primitives: ['gravity', 'charge', 'memory', 'cohesion', 'repel'],
    bodies: [
      { body: 'gravity', strength: 1, range: 360, feedback: true },
      { body: 'charge', strength: 0.6, range: 300, spin: 1 },
      { body: 'memory cohesion', strength: 0.6, range: 280 },
      { body: 'repel', strength: 0.7, range: 260 },
    ],
    render: ['dots', 'metaballs', 'particles'],
    metrics: ['intent', 'confidence', 'memory', 'risk'],
    diagnostics: ['potential', 'causality', 'topology'],
    accessibility: {
      reducedMotion: 'ranked command groups with risk labels and recency indicators',
      meaningWithoutMotion: 'commands appear as a ranked list with risk labels and recency badges, no settling animation required',
    },
    notes: 'Likely commands sink into a gravity well while dangerous ones repel — electromagnetic charge clusters the related, gravity decides what rises to the top.',
  },
  {
    id: 'selection-wake',
    name: 'Selection Wake',
    intent: 'leave a subtle trail of user interaction and selection',
    naturalField: 'weak',
    primitives: ['memory', 'diffuse', 'fieldflow', 'stream'],
    bodies: [
      { body: 'memory', strength: 0.9, range: 300, feedback: true },
      { body: 'diffuse', strength: 0.6, range: 280 },
      { body: 'fieldflow', strength: 0.6, range: 0 },
      { body: 'stream', strength: 0.5, range: 320, angle: 0 },
    ],
    render: ['trails', 'heatmap', 'particles'],
    metrics: ['memory', 'recency', 'trail'],
    diagnostics: ['heatmap', 'contours', 'force-vectors'],
    accessibility: {
      reducedMotion: 'selection-history marks with recent-item badges and a static trail rail',
      meaningWithoutMotion: 'a static history rail lists recently touched items with recency badges in place of a fading wake',
    },
    notes: 'Memory holds the wake while diffuse lets it fade, and fieldflow carries repeated paths into usage trails — transport that remembers where attention has been.',
  },
  {
    id: 'availability-pressure',
    name: 'Availability Pressure',
    intent: 'show schedule density, conflicts, and open space',
    naturalField: 'gravity',
    primitives: ['gravity', 'pressure', 'tether', 'repel', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1, range: 380, feedback: true },
      { body: 'pressure', strength: 0.8, range: 300 },
      { body: 'tether', strength: 0.6, range: 280 },
      { body: 'repel memory', strength: 0.6, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'particles'],
    metrics: ['pressure', 'availability', 'conflict', 'flexibility'],
    diagnostics: ['contours', 'potential', 'causality'],
    accessibility: {
      reducedMotion: 'density shading with conflict badges and open-space markers',
      meaningWithoutMotion: 'busy and open blocks read through density shading, conflict badges, and explicit open-space markers',
    },
    notes: 'Deadlines sink into gravitational wells and busy blocks raise pressure, while elastic events ride a tether (spring) — schedule density read as a gravity-and-pressure landscape.',
  },
  {
    id: 'dependency-tension',
    name: 'Dependency Tension',
    intent: 'reveal constraints, blockers, and coupled states',
    naturalField: 'strong',
    primitives: ['link', 'tether', 'charge', 'pressure'],
    bodies: [
      { body: 'link', strength: 1, range: 360, feedback: true },
      { body: 'tether', strength: 0.8, range: 320 },
      { body: 'charge', strength: 0.6, range: 300, spin: 1 },
      { body: 'pressure', strength: 0.6, range: 280 },
    ],
    relationships: [{ from: 'task', to: 'blocker', type: 'depends-on', strength: 0.9 }],
    render: ['links', 'field-lines', 'particles'],
    metrics: ['tension', 'blocked', 'coherence', 'heat'],
    diagnostics: ['topology', 'causality', 'inspector'],
    accessibility: {
      reducedMotion: 'a dependency table with a blocker count and tension badges',
      meaningWithoutMotion: 'dependencies and blockers read as a table with a blocker count and per-edge tension badges',
    },
    notes: 'The strong force binds coupled items through tether (spring) tension while electromagnetic charge pulls conflicting paths apart — blocked links heat, resolved ones cool.',
  },
  {
    id: 'staleness-drift',
    name: 'Staleness Drift',
    intent: 'make outdated content, data, or files cool and recede',
    naturalField: 'weak',
    primitives: ['memory', 'morph', 'diffuse'],
    bodies: [
      { body: 'memory', strength: 0.9, range: 300, feedback: true },
      { body: 'morph', strength: 0.6, range: 280 },
      { body: 'diffuse', strength: 0.6, range: 260 },
    ],
    render: ['heatmap', 'trails', 'particles'],
    metrics: ['age', 'staleness', 'memory', 'confidence'],
    diagnostics: ['heatmap', 'contours', 'inspector'],
    accessibility: {
      reducedMotion: 'stale badges with an aging tone and a last-verified marker',
      meaningWithoutMotion: 'staleness reads through stale badges, aging tone, and an explicit last-verified date',
    },
    notes: 'Like a weak-force decay, unattended items morph and diffuse toward the background while memory lets a revisit pull them back into coherence.',
  },
  {
    id: 'trust-gradient',
    name: 'Trust Gradient',
    intent: 'show confidence, verification, and unsupported claims',
    naturalField: 'electromagnetic',
    primitives: ['charge', 'link', 'cohesion', 'memory'],
    bodies: [
      { body: 'charge', strength: 1, range: 360, spin: 1, feedback: true },
      { body: 'link', strength: 0.7, range: 320 },
      { body: 'cohesion', strength: 0.6, range: 300 },
      { body: 'memory', strength: 0.5, range: 260 },
    ],
    render: ['heatmap', 'links', 'particles'],
    metrics: ['trust', 'confidence', 'coherence', 'entropy'],
    diagnostics: ['causality', 'topology', 'inspector'],
    accessibility: {
      reducedMotion: 'trust badges with an evidence table and an unsupported-claim list',
      meaningWithoutMotion: 'trust reads through per-claim badges, a supporting-evidence table, and a flagged unsupported-claim list',
    },
    notes: 'Electromagnetic charge pulls verified claims into coherence and separates contradictions, while links to sources set the trust gradient — evidence is the field, confidence the potential.',
  },
  {
    id: 'completion-release',
    name: 'Completion Release',
    intent: 'let finished work release pressure and settle into memory',
    naturalField: 'weak',
    primitives: ['morph', 'memory', 'gravity', 'pressure', 'cohesion'],
    bodies: [
      { body: 'morph', strength: 0.9, range: 300, feedback: true },
      { body: 'memory', strength: 0.7, range: 280 },
      { body: 'gravity pressure', strength: 0.6, range: 320 },
      { body: 'cohesion', strength: 0.6, range: 280 },
    ],
    render: ['metaballs', 'trails', 'particles'],
    metrics: ['completion', 'pressure', 'memory', 'coherence'],
    diagnostics: ['energy', 'inspector', 'prediction'],
    accessibility: {
      reducedMotion: 'a completion marker with a resolved-state badge and a stable history line',
      meaningWithoutMotion: 'finished work reads as a resolved-state badge plus a stable history-line entry rather than vanishing',
    },
    notes: 'Active work holds pressure under gravity; completion is a weak-force phase change (morph) that releases the tension and leaves a memory mark instead of disappearing.',
  },
  {
    id: 'group-magnet',
    name: 'Group Magnet',
    intent: 'let related cards, assets, or controls cluster intelligently',
    naturalField: 'strong',
    primitives: ['cohesion', 'gravity', 'crystallize', 'link', 'memory'],
    bodies: [
      { body: 'cohesion', strength: 1, range: 340, feedback: true },
      { body: 'gravity', strength: 0.8, range: 360 },
      { body: 'crystallize link', strength: 0.6, range: 300 },
      { body: 'memory', strength: 0.5, range: 260 },
    ],
    render: ['metaballs', 'links', 'particles'],
    metrics: ['cluster', 'density', 'relation-strength'],
    diagnostics: ['topology', 'potential', 'heatmap'],
    accessibility: {
      reducedMotion: 'grouped sections with relation badges and cluster headings',
      meaningWithoutMotion: 'clusters read as labeled grouped sections with relation badges, no magnetic motion required',
    },
    notes: 'The strong force binds related items into one cluster around a representative center while gravity sets the local hub — crystallize snaps stragglers onto the lattice.',
  },
  {
    id: 'error-pressure',
    name: 'Error Pressure',
    intent: 'show accumulated instability without harsh alert patterns',
    naturalField: 'weak',
    primitives: ['thermal', 'pressure', 'morph', 'memory', 'diffuse'],
    bodies: [
      { body: 'thermal', strength: 1, range: 320, feedback: true },
      { body: 'pressure', strength: 0.8, range: 300 },
      { body: 'morph memory', strength: 0.5, range: 280 },
      { body: 'diffuse', strength: 0.6, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'particles'],
    metrics: ['error', 'heat', 'entropy', 'pressure'],
    diagnostics: ['heatmap', 'energy', 'causality'],
    accessibility: {
      reducedMotion: 'an error summary with heat badges and an affected-section rail',
      meaningWithoutMotion: 'errors read through a summary count, per-section heat badges, and an affected-section rail',
    },
    notes: 'Errors add thermal heat and entropy that accumulate as pressure; resolved ones cool and, like a weak decay, morph into history instead of flashing an alarm.',
  },
  {
    id: 'handoff-stream',
    name: 'Handoff Stream',
    intent: 'show ownership or state moving from one person or system to another',
    naturalField: 'electromagnetic',
    primitives: ['fieldflow', 'propagate', 'link', 'memory', 'morph'],
    bodies: [
      { body: 'fieldflow', strength: 1, range: 0, feedback: true },
      { body: 'propagate', strength: 0.7, range: 320 },
      { body: 'link memory', strength: 0.6, range: 300 },
      { body: 'morph', strength: 0.5, range: 280 },
    ],
    relationships: [{ from: 'owner', to: 'recipient', type: 'hands-off', strength: 0.9 }],
    render: ['streamlines', 'field-lines', 'trails', 'particles'],
    metrics: ['handoff', 'current', 'memory', 'state'],
    diagnostics: ['field-lines', 'force-vectors', 'topology'],
    accessibility: {
      reducedMotion: 'a transfer timeline with owner badges and a handoff log',
      meaningWithoutMotion: 'the transfer reads as a timeline of owner badges plus a handoff log entry, not a flowing animation',
    },
    notes: 'Magnetism bends the path between owners and fieldflow carries the object along it — the source cools, the target warms, and a memory trace records the transfer.',
  },
  {
    id: 'context-halo',
    name: 'Context Halo',
    intent: 'reveal nearby relevant context around a focused element',
    naturalField: 'gravity',
    primitives: ['gravity', 'memory', 'link', 'cohesion'],
    bodies: [
      { body: 'gravity', strength: 1, range: 360, feedback: true },
      { body: 'memory', strength: 0.6, range: 300 },
      { body: 'link', strength: 0.6, range: 320 },
      { body: 'cohesion', strength: 0.6, range: 280 },
    ],
    render: ['metaballs', 'links', 'particles'],
    metrics: ['context', 'attention', 'memory', 'relation-strength'],
    diagnostics: ['topology', 'potential', 'inspector'],
    accessibility: {
      reducedMotion: 'a context panel with a related-links list and local callouts',
      meaningWithoutMotion: 'related context reads as a panel of ordered related links and callouts ranked by relation strength',
    },
    notes: 'A focused element becomes a gravity well that draws nearby definitions, examples, and prior interactions inward — relevance ranked by relation strength, not fixed placement.',
  },
  {
    id: 'field-tutorial',
    name: 'Field Tutorial',
    intent: 'teach field-ui by revealing DOM, bodies, fields, metrics, feedback, and overlays',
    primitives: ['attract'],
    bodies: [{ body: 'attract', strength: 0.6, range: 300, feedback: true }],
    render: ['particles', 'field-lines', 'dots'],
    metrics: ['teaching', 'attention'],
    diagnostics: ['inspector', 'topology', 'field-lines', 'causality', 'prediction'],
    accessibility: {
      reducedMotion: 'a stepper with static diagrams and live code snippets at each stage',
      meaningWithoutMotion: 'each stage is a labeled step with a static diagram and the exact code, so the lesson reads fully without animation',
    },
    notes: 'A narrative diagnostic recipe: a single attract body gives the inspector something real to read while the interface reveals itself stage by stage — DOM, bodies, fields, metrics, feedback, overlays, reduced-motion.',
  },
];

/**
 * Tier 3 — professional systems: safety, provenance, governance (recipes 33-48). Advanced semantic,
 * safety, and inspection patterns.
 */
const TIER_SYSTEMS: readonly FieldRecipe[] = [
  {
    id: 'semantic-gravity-map',
    name: 'Semantic Gravity Map',
    intent: 'let a document or app reveal which concepts carry the most weight',
    naturalField: 'gravity',
    primitives: ['gravity', 'link', 'cohesion', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1.1, range: 400, feedback: true },
      { body: 'link', strength: 0.7, range: 320 },
      { body: 'cohesion', strength: 0.6, range: 280 },
      { body: 'memory', strength: 0.5, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'links', 'particles'],
    metrics: ['mass', 'attention', 'relation-strength', 'density'],
    diagnostics: ['potential', 'topology', 'heatmap'],
    accessibility: {
      reducedMotion: 'a weighted concept index with an importance rail and a section density map',
      meaningWithoutMotion: 'mass becomes a sorted importance ranking with explicit weight values per concept',
    },
    notes: 'Gravity pulls heavy concepts to the center while link and cohesion bind related ones; importance is mass, memory keeps recurrence felt over time.',
  },
  {
    id: 'polarity-filter',
    name: 'Polarity Filter',
    intent: 'let opposing states, tags, or preferences sort themselves visibly',
    naturalField: 'electromagnetic',
    primitives: ['charge', 'repel', 'attract', 'diffuse'],
    bodies: [
      { body: 'charge', strength: 1, range: 380, spin: 1, feedback: true },
      { body: 'repel', strength: 0.8, range: 320 },
      { body: 'attract', strength: 0.7, range: 340 },
      { body: 'diffuse', strength: 0.5, range: 260 },
    ],
    render: ['field-lines', 'particles', 'dots', 'trails'],
    metrics: ['polarity', 'match', 'distance'],
    diagnostics: ['field-lines', 'causality', 'potential'],
    accessibility: {
      reducedMotion: 'grouped filter lanes with signed badges and separate match and conflict sections',
      meaningWithoutMotion: 'polarity reads as a signed badge and items live in labeled match or conflict groups',
    },
    notes: 'Electric pushes and pulls by sign: matching charge attracts toward the active filter, opposing charge repels, and diffuse keeps neutral items quietly stable.',
  },
  {
    id: 'source-constellation',
    name: 'Source Constellation',
    intent: 'show how multiple sources gather around claims, topics, or decisions',
    naturalField: 'strong',
    primitives: ['link', 'charge', 'gravity', 'memory', 'cohesion'],
    bodies: [
      { body: 'link', strength: 1, range: 360, feedback: true },
      { body: 'charge', strength: 0.7, range: 340, spin: 1 },
      { body: 'gravity', strength: 0.8, range: 380 },
      { body: 'memory', strength: 0.5, range: 280 },
      { body: 'cohesion', strength: 0.6, range: 300 },
    ],
    relationships: [{ from: 'source', to: 'claim', type: 'support', strength: 0.8 }],
    render: ['links', 'metaballs', 'particles', 'trails'],
    metrics: ['confidence', 'support', 'citation-density', 'memory'],
    diagnostics: ['topology', 'causality', 'potential'],
    accessibility: {
      reducedMotion: 'a claim and source matrix with a source ranking and labeled support clusters',
      meaningWithoutMotion: 'support becomes a ranked matrix where distance is a number and contradiction is a marked row',
    },
    notes: 'Strong binding holds sources to the claims they support while electric charge lets contradictory sources carry the opposite sign; repeatedly cited sources gain mass and memory.',
  },
  {
    id: 'drift-correction',
    name: 'Drift Correction',
    intent: 'bring wandering attention or unstable layout back into coherence',
    naturalField: 'weak',
    primitives: ['gravity', 'tether', 'memory', 'morph'],
    bodies: [
      { body: 'gravity', strength: 0.6, range: 360, feedback: true },
      { body: 'tether', strength: 0.7, range: 320 },
      { body: 'memory', strength: 0.5, range: 280 },
      { body: 'morph', strength: 0.4, range: 240 },
    ],
    render: ['streamlines', 'trails', 'particles', 'dots'],
    metrics: ['drift', 'return', 'stability'],
    diagnostics: ['prediction', 'force-vectors', 'inspector'],
    accessibility: {
      reducedMotion: 'a snap guide with a restore marker and a stable-state outline',
      meaningWithoutMotion: 'drift reads as a labeled distance from the stable state with a one-step restore control',
    },
    notes: 'A weak corrective pull is the gentle counterpart to gravity: tether (spring) remembers the stable relation and morph eases the return so wandering settles without snapping.',
  },
  {
    id: 'resonance-match',
    name: 'Resonance Match',
    intent: 'highlight elements that ring with the user current intent',
    naturalField: 'electromagnetic',
    primitives: ['charge', 'memory', 'cohesion', 'propagate'],
    bodies: [
      { body: 'charge', strength: 1, range: 380, spin: 1, feedback: true },
      { body: 'memory', strength: 0.7, range: 300 },
      { body: 'cohesion', strength: 0.6, range: 280 },
      { body: 'propagate', strength: 0.5, range: 320 },
    ],
    render: ['field-lines', 'links', 'particles', 'trails'],
    metrics: ['resonance', 'intent', 'confidence', 'memory'],
    diagnostics: ['causality', 'topology', 'field-lines'],
    accessibility: {
      reducedMotion: 'a related-item list with resonance badges and ranked suggestions',
      meaningWithoutMotion: 'resonance becomes a ranked list of matches with explicit strength badges rather than a glow',
    },
    notes: 'Electric charge lets elements ring with shared terms while memory carries history and propagate spreads the match; resonance shows as coherence, not noise.',
  },
  {
    id: 'friction-gate',
    name: 'Friction Gate',
    intent: 'slow risky, destructive, or irreversible actions without modal noise',
    primitives: ['viscosity', 'pressure', 'gate', 'morph'],
    bodies: [
      { body: 'viscosity', strength: 1, range: 300, feedback: true },
      { body: 'pressure', strength: 0.7, range: 280 },
      { body: 'gate', strength: 0.6, range: 240 },
      { body: 'morph', strength: 0.5, range: 220 },
    ],
    render: ['streamlines', 'heatmap', 'particles', 'trails'],
    metrics: ['risk', 'friction', 'intent', 'readiness'],
    diagnostics: ['inspector', 'prediction', 'energy'],
    accessibility: {
      reducedMotion: 'a confirmation rail moving from a disabled to a ready state with an explicit risk summary',
      meaningWithoutMotion: 'friction becomes a readiness meter and the action stays disabled until an explicit risk summary is acknowledged',
    },
    notes: 'Derived from drag: viscosity makes risky motion deliberate, gate holds release until coherence builds, and morph marks the disabled-to-ready transition without a disruptive modal.',
  },
  {
    id: 'boundary-field',
    name: 'Boundary Field',
    intent: 'make safe zones, drop zones, scopes, and containers perceptible',
    naturalField: 'strong',
    primitives: ['wall', 'sink', 'repel', 'cohesion'],
    bodies: [
      { body: 'wall', strength: 1.1, range: 320, feedback: true },
      { body: 'sink', strength: 0.7, range: 280 },
      { body: 'repel', strength: 0.8, range: 300 },
      { body: 'cohesion', strength: 0.6, range: 260 },
    ],
    render: ['field-lines', 'metaballs', 'particles', 'dots'],
    metrics: ['boundary', 'proximity', 'validity'],
    diagnostics: ['contours', 'force-vectors', 'inspector'],
    accessibility: {
      reducedMotion: 'a boundary outline with valid and invalid zone labels and a static drop affordance',
      meaningWithoutMotion: 'the container shows a drawn outline and each item is labeled valid or invalid for that zone',
    },
    notes: 'Strong containment gives containers an edge: wall reflects invalid objects, sink absorbs valid ones into the scope, and cohesion makes the boundary visible as you approach; electric repel screens what does not belong.',
  },
  {
    id: 'threshold-bloom',
    name: 'Threshold Bloom',
    intent: 'reveal meaningful state changes only when a threshold is crossed',
    naturalField: 'weak',
    primitives: ['gate', 'morph', 'spawn', 'charge', 'memory'],
    bodies: [
      { body: 'gate', strength: 1, range: 280, feedback: true },
      { body: 'morph', strength: 0.7, range: 260 },
      { body: 'spawn', strength: 0.6, range: 300 },
      { body: 'charge', strength: 0.5, range: 320, spin: 1 },
      { body: 'memory', strength: 0.5, range: 240 },
    ],
    render: ['metaballs', 'heatmap', 'particles', 'trails'],
    metrics: ['threshold', 'activation', 'heat', 'memory'],
    diagnostics: ['causality', 'energy', 'inspector'],
    accessibility: {
      reducedMotion: 'a threshold marker with a status badge and an event log entry',
      meaningWithoutMotion: 'crossing the threshold flips a status badge and writes a dated event log entry instead of a bloom',
    },
    notes: 'A weak event waits quietly until the gate opens, then morph and spawn bloom the transition while charge marks the moment; memory keeps the event inspectable after it settles.',
  },
  {
    id: 'latency-ripple',
    name: 'Latency Ripple',
    intent: 'show delay, loading, sync, and distributed system response as waves',
    naturalField: 'electromagnetic',
    primitives: ['propagate', 'diffuse', 'fieldflow', 'memory'],
    bodies: [
      { body: 'propagate', strength: 1, range: 400, feedback: true },
      { body: 'diffuse', strength: 0.7, range: 320 },
      { body: 'fieldflow', strength: 0.6, range: 0 },
      { body: 'memory', strength: 0.5, range: 280 },
    ],
    render: ['streamlines', 'field-lines', 'particles', 'trails'],
    metrics: ['latency', 'signal', 'damping', 'sync'],
    diagnostics: ['contours', 'force-vectors', 'prediction'],
    accessibility: {
      reducedMotion: 'a sync timeline with an affected-region list and latency badges',
      meaningWithoutMotion: 'delay becomes a per-region latency badge and a timeline rather than a traveling wave',
    },
    notes: 'A signal propagates outward and fieldflow carries it to affected regions; diffuse damps slow or blocked areas so delay reads as distance, not a spinner.',
  },
  {
    id: 'provenance-trail',
    name: 'Provenance Trail',
    intent: 'preserve the origin and transformation history of content or data',
    naturalField: 'strong',
    primitives: ['memory', 'link', 'morph', 'cohesion'],
    bodies: [
      { body: 'memory', strength: 1.1, range: 320, feedback: true },
      { body: 'link', strength: 0.8, range: 360 },
      { body: 'morph', strength: 0.5, range: 260 },
      { body: 'cohesion', strength: 0.6, range: 280 },
    ],
    render: ['links', 'trails', 'particles', 'field-lines'],
    metrics: ['provenance', 'memory', 'transform-count', 'source-strength'],
    diagnostics: ['causality', 'topology', 'inspector'],
    accessibility: {
      reducedMotion: 'a provenance drawer with a lineage list and source badges',
      meaningWithoutMotion: 'history becomes an ordered lineage list with source badges and a transform count per step',
    },
    notes: 'Strong binding keeps sources fused to content while memory holds the trace and morph records each transformation; lineage stays inspectable without flooding the view.',
  },
  {
    id: 'review-pressure',
    name: 'Review Pressure',
    intent: 'surface items needing review before they decay, expire, or block work',
    naturalField: 'gravity',
    primitives: ['gravity', 'pressure', 'memory', 'morph', 'thermal'],
    bodies: [
      { body: 'gravity', strength: 1.1, range: 400, feedback: true },
      { body: 'pressure', strength: 0.8, range: 320 },
      { body: 'memory', strength: 0.6, range: 280 },
      { body: 'morph', strength: 0.5, range: 240 },
      { body: 'thermal', strength: 0.5, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'particles', 'dots'],
    metrics: ['review-pressure', 'age', 'risk', 'priority'],
    diagnostics: ['potential', 'heatmap', 'inspector'],
    accessibility: {
      reducedMotion: 'a review queue ranking with urgency badges and age markers',
      meaningWithoutMotion: 'pressure becomes a sorted review queue where age and risk are explicit badges per item',
    },
    notes: 'Items build gravitational priority as the weak pull of age and pressure accumulates; thermal stands in for rising entropy so high-risk or blocked work surfaces on its own while low-risk stays calm.',
  },
  {
    id: 'semantic-snap',
    name: 'Semantic Snap',
    intent: 'align objects, cards, or text fragments by meaning instead of only geometry',
    naturalField: 'strong',
    primitives: ['link', 'tether', 'cohesion', 'crystallize'],
    bodies: [
      { body: 'link', strength: 1, range: 360, feedback: true },
      { body: 'tether', strength: 0.8, range: 300 },
      { body: 'cohesion', strength: 0.6, range: 280 },
      { body: 'crystallize', strength: 0.6, range: 260 },
    ],
    render: ['links', 'field-lines', 'particles', 'dots'],
    metrics: ['snap', 'relation-strength', 'alignment'],
    diagnostics: ['topology', 'force-vectors', 'inspector'],
    accessibility: {
      reducedMotion: 'snap guides with semantic alignment labels and relation hints',
      meaningWithoutMotion: 'snapping becomes labeled alignment guides naming the relationship that pulled two items together',
    },
    notes: 'Strong relational binding lets objects snap by meaning: link and tether (spring) draw matching tags or dependent blocks together while crystallize locks them into a clean semantic alignment.',
  },
  {
    id: 'ambient-tutor',
    name: 'Ambient Tutor',
    intent: 'teach the interface quietly based on hesitation, return, and attention',
    naturalField: 'gravity',
    primitives: ['memory', 'gravity', 'propagate', 'link'],
    bodies: [
      { body: 'memory', strength: 1, range: 300, feedback: true },
      { body: 'gravity', strength: 0.7, range: 360 },
      { body: 'propagate', strength: 0.5, range: 320 },
      { body: 'link', strength: 0.6, range: 280 },
    ],
    render: ['heatmap', 'trails', 'particles', 'links'],
    metrics: ['hesitation', 'return', 'helpfulness', 'attention'],
    diagnostics: ['heatmap', 'causality', 'inspector'],
    accessibility: {
      reducedMotion: 'contextual tips with a help rail and related-explanation markers',
      meaningWithoutMotion: 'help surfaces as a contextual tip near the point of need with a list of related explanations',
    },
    notes: 'Memory watches hesitation and repeated returns while gravity gives the right explanation subtle priority near the point of need; propagate and link carry help to related controls.',
  },
  {
    id: 'relation-lens',
    name: 'Relation Lens',
    intent: 'temporarily reveal hidden connections without changing layout',
    naturalField: 'strong',
    primitives: ['link', 'memory', 'cohesion'],
    bodies: [
      { body: 'link', strength: 1.1, range: 380, feedback: true },
      { body: 'memory', strength: 0.6, range: 280 },
      { body: 'cohesion', strength: 0.6, range: 300 },
    ],
    render: ['links', 'field-lines', 'particles', 'dots'],
    metrics: ['relation-strength', 'active-relation', 'density'],
    diagnostics: ['topology', 'inspector', 'causality'],
    accessibility: {
      reducedMotion: 'a relation list with numbered connectors and a static map',
      meaningWithoutMotion: 'connections become a numbered list pairing each element with what it relates to, layout unchanged',
    },
    notes: 'Strong relational binding lets the lens light up link bonds among visible elements; memory and cohesion hold the revealed map steady so definitions, citations, and dependencies show without moving anything.',
  },
  {
    id: 'priority-tide',
    name: 'Priority Tide',
    intent: 'let importance rise and fall over time, workload, or context',
    naturalField: 'gravity',
    primitives: ['gravity', 'morph', 'memory', 'diffuse', 'pressure'],
    bodies: [
      { body: 'gravity', strength: 1, range: 400, feedback: true },
      { body: 'morph', strength: 0.6, range: 280 },
      { body: 'memory', strength: 0.6, range: 260 },
      { body: 'diffuse', strength: 0.5, range: 300 },
      { body: 'pressure', strength: 0.6, range: 320 },
    ],
    render: ['heatmap', 'metaballs', 'particles', 'trails'],
    metrics: ['priority', 'age', 'deadline', 'decay'],
    diagnostics: ['potential', 'prediction', 'heatmap'],
    accessibility: {
      reducedMotion: 'a priority ordering with aging badges and a deadline rail',
      meaningWithoutMotion: 'tidal importance becomes a re-sortable ranked list with explicit age and deadline values',
    },
    notes: 'Gravity sets importance while the weak pulls of age and deadline make it tidal: morph and diffuse let priority rise and ebb so nothing stays permanently loud, and memory keeps the decay honest.',
  },
  {
    id: 'field-contract-preview',
    name: 'Field Contract Preview',
    intent: 'show exactly what a recipe will register, measure, write, and render before enabling it',
    primitives: ['attract'],
    bodies: [{ body: 'attract', strength: 0.6, range: 280, feedback: true }],
    render: ['particles', 'dots'],
    metrics: ['scope', 'impact', 'risk'],
    diagnostics: ['inspector', 'topology', 'causality'],
    accessibility: {
      reducedMotion: 'a static contract table listing what the recipe registers, measures, writes, and renders',
      meaningWithoutMotion: 'the preview is a plain table of registrations, measurements, writes, and announcements with no motion at all',
    },
    notes: 'A platform diagnostic, not a force: it reads the registries and lintPlatform to make field behavior auditable before enabling, with one minimal sample body so the contract itself stays inspectable.',
  },
];

/**
 * Tier 4 — enterprise, collaborative, adaptive, operational (recipes 49-64). Multi-actor and
 * live-system patterns.
 */
const TIER_ENTERPRISE: readonly FieldRecipe[] = [
  {
    id: 'presence-field',
    name: 'Presence Field',
    intent: 'show collaborators as live influence, not static avatars',
    naturalField: 'electromagnetic',
    primitives: ['charge', 'propagate', 'fieldflow', 'memory', 'link'],
    bodies: [
      { body: 'charge', strength: 0.9, range: 360, spin: 1, feedback: true },
      { body: 'propagate', strength: 0.6, range: 320 },
      { body: 'fieldflow', strength: 0.7, range: 0 },
      { body: 'memory', strength: 0.5, range: 260 },
      { body: 'link', strength: 0.6, range: 300 },
    ],
    relationships: [{ from: 'collaborator', to: 'object', type: 'present-at', strength: 0.7 }],
    render: ['field-lines', 'links', 'heatmap', 'particles'],
    metrics: ['presence', 'recency', 'signal', 'attention'],
    diagnostics: ['topology', 'causality', 'heatmap'],
    accessibility: {
      reducedMotion: 'a collaborator rail with recent-edit marks and static presence badges',
      meaningWithoutMotion: 'each collaborator is a labelled badge with a recency timestamp and the object they are near',
    },
    notes: 'Each focused collaborator is a charge emitting signal; propagate carries it, fieldflow draws presence toward shared objects, and recent edits cool into memory. Electric pushes, magnetic bends, fieldflow carries.',
  },
  {
    id: 'consensus-well',
    name: 'Consensus Well',
    intent: 'let agreement gather around stable options or decisions',
    naturalField: 'gravity',
    primitives: ['gravity', 'cohesion', 'link', 'pressure', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1.1, range: 400, feedback: true },
      { body: 'cohesion', strength: 0.8, range: 320 },
      { body: 'link', strength: 0.6, range: 300 },
      { body: 'pressure', strength: 0.5, range: 240 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    relationships: [{ from: 'argument', to: 'option', type: 'supports', strength: 0.7 }],
    render: ['metaballs', 'links', 'heatmap', 'particles'],
    metrics: ['consensus', 'coherence', 'support', 'tension'],
    diagnostics: ['potential', 'topology', 'causality'],
    accessibility: {
      reducedMotion: 'a support matrix with an agreement meter and dissent markers',
      meaningWithoutMotion: 'each option shows a numeric support count, a coherence label, and listed dissenting arguments',
    },
    notes: 'Options that gather agreement gain mass and pull arguments into a single well; cohesion binds the supporters while pressure exposes fragile, contested consensus instead of false certainty (gravity gathering mass, the strong bind holding it).',
  },
  {
    id: 'disagreement-charge',
    name: 'Disagreement Charge',
    intent: 'make unresolved conflict visible without turning it into noise',
    naturalField: 'electromagnetic',
    primitives: ['charge', 'repel', 'thermal', 'morph', 'memory'],
    bodies: [
      { body: 'charge', strength: 1, range: 340, spin: 1, feedback: true },
      { body: 'repel', strength: 0.7, range: 300 },
      { body: 'thermal', strength: 0.5, range: 280 },
      { body: 'morph', strength: 0.4, range: 220 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    relationships: [{ from: 'claim', to: 'counter-claim', type: 'opposes', strength: 0.6 }],
    render: ['field-lines', 'heatmap', 'links', 'particles'],
    metrics: ['disagreement', 'entropy', 'resolution', 'memory'],
    diagnostics: ['causality', 'topology', 'field-lines'],
    accessibility: {
      reducedMotion: 'conflict pairs with a resolution-state column and a disagreement summary',
      meaningWithoutMotion: 'each conflict is a labelled pair of claims with a resolved/open state and an entropy score',
    },
    notes: 'Opposing claims carry like charge and repel into visible separation, thermal entropy marking heated conflict; once resolved, the claim morphs and decays into memory rather than alarming. Electric pushes, magnetic bends.',
  },
  {
    id: 'change-shockwave',
    name: 'Change Shockwave',
    intent: 'show the downstream impact of a change across a system',
    naturalField: 'electromagnetic',
    primitives: ['propagate', 'link', 'pressure', 'morph', 'memory'],
    bodies: [
      { body: 'propagate', strength: 1, range: 400, feedback: true },
      { body: 'link', strength: 0.7, range: 320 },
      { body: 'pressure', strength: 0.6, range: 280 },
      { body: 'morph', strength: 0.4, range: 220 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    relationships: [{ from: 'change', to: 'dependency', type: 'affects', strength: 0.7 }],
    render: ['streamlines', 'field-lines', 'links', 'particles'],
    metrics: ['impact', 'latency', 'risk', 'distance'],
    diagnostics: ['contours', 'topology', 'causality', 'prediction'],
    accessibility: {
      reducedMotion: 'an impact tree with an affected-item list and downstream badges',
      meaningWithoutMotion: 'each affected item is listed by dependency distance with a risk badge, ordered by impact',
    },
    notes: 'A change emits a wave that propagates along links: immediate dependencies light first, distant ones respond damped and late, and critical downstream effects raise pressure (propagation carries the wavefront; the weak interaction lets items morph).',
  },
  {
    id: 'permission-boundary',
    name: 'Permission Boundary',
    intent: 'make access, scope, and protected regions legible',
    naturalField: 'strong',
    primitives: ['wall', 'sink', 'charge', 'link'],
    bodies: [
      { body: 'wall', strength: 1.1, range: 320, feedback: true },
      { body: 'sink', strength: 0.6, range: 240 },
      { body: 'charge', strength: 0.6, range: 300, spin: 1 },
      { body: 'link', strength: 0.5, range: 280 },
    ],
    relationships: [{ from: 'actor', to: 'region', type: 'authorized-for', strength: 0.7 }],
    render: ['voronoi', 'links', 'field-lines', 'particles'],
    metrics: ['permission', 'scope', 'risk', 'boundary'],
    diagnostics: ['contours', 'force-vectors', 'inspector'],
    accessibility: {
      reducedMotion: 'access labels with protected-region outlines and a permission summary',
      meaningWithoutMotion: 'each region is an outlined zone with an access label and a per-actor allow/deny list',
    },
    notes: 'Protected regions hold like walls: authorized actors pass cleanly while unauthorized or risky ones meet resistance and are absorbed (sink) at the boundary. The strong bind confines scope; charge gives each actor its polarity.',
  },
  {
    id: 'risk-horizon',
    name: 'Risk Horizon',
    intent: 'reveal approaching risk before it becomes an error',
    naturalField: 'gravity',
    primitives: ['gravity', 'pressure', 'morph', 'diffuse', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1, range: 400, feedback: true },
      { body: 'pressure', strength: 0.7, range: 300 },
      { body: 'morph', strength: 0.5, range: 240 },
      { body: 'diffuse', strength: 0.4, range: 280 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    render: ['heatmap', 'field-lines', 'metaballs', 'particles'],
    metrics: ['risk', 'pressure', 'threshold', 'entropy'],
    diagnostics: ['potential', 'contours', 'prediction'],
    accessibility: {
      reducedMotion: 'a risk-horizon line with threshold markers and an affected-region list',
      meaningWithoutMotion: 'risk is a labelled threshold line; affected regions are listed with their distance to it',
    },
    notes: 'Risk forms a horizon that pulls like gravity: as it rises, affected elements gain pressure, draw attention, and drift toward the threshold, diffusing the warning outward before any error lands (the weak interaction lets the state morph as it crosses).',
  },
  {
    id: 'intent-magnet',
    name: 'Intent Magnet',
    intent: "pull likely actions toward the user's current context",
    naturalField: 'gravity',
    primitives: ['gravity', 'memory', 'link', 'cohesion'],
    bodies: [
      { body: 'gravity', strength: 0.9, range: 380, feedback: true },
      { body: 'memory', strength: 0.6, range: 280 },
      { body: 'link', strength: 0.6, range: 300 },
      { body: 'cohesion', strength: 0.5, range: 260 },
    ],
    relationships: [{ from: 'focus', to: 'action', type: 'suggests', strength: 0.6 }],
    render: ['links', 'field-lines', 'dots', 'particles'],
    metrics: ['intent', 'confidence', 'memory', 'next-action'],
    diagnostics: ['potential', 'causality', 'inspector'],
    accessibility: {
      reducedMotion: 'a suggested-actions list with a next-step badge and contextual shortcuts',
      meaningWithoutMotion: 'likely actions are ranked in a list by confidence, each labelled with why it was suggested',
    },
    notes: 'Current focus, history, and task state become a gentle gravity center that draws likely next actions closer; memory weights what worked before while cohesion keeps related actions together, assisting without taking control.',
  },
  {
    id: 'flow-checkpoint',
    name: 'Flow Checkpoint',
    intent: 'stabilize multi-step flows around milestones',
    naturalField: 'strong',
    primitives: ['fieldflow', 'link', 'cohesion', 'memory', 'morph'],
    bodies: [
      { body: 'fieldflow', strength: 0.9, range: 0, feedback: true },
      { body: 'link', strength: 0.7, range: 320 },
      { body: 'cohesion', strength: 0.7, range: 300 },
      { body: 'memory', strength: 0.5, range: 260 },
      { body: 'morph', strength: 0.4, range: 220 },
    ],
    relationships: [{ from: 'step', to: 'checkpoint', type: 'anchors-to', strength: 0.7 }],
    render: ['streamlines', 'links', 'field-lines', 'particles'],
    metrics: ['progress', 'checkpoint', 'memory', 'coherence'],
    diagnostics: ['topology', 'force-vectors', 'prediction'],
    accessibility: {
      reducedMotion: 'a stepper with a checkpoint rail and completed-step markers',
      meaningWithoutMotion: 'the flow is an ordered stepper; completed milestones are marked and anchor the remaining steps',
    },
    notes: 'Multi-step flows form a current that fieldflow carries forward, but checkpoints bind like strong anchors: completed milestones hold structure with cohesion while progress keeps streaming ahead (the strong bind stabilizes, transport carries).',
  },
  {
    id: 'version-gravity',
    name: 'Version Gravity',
    intent: 'show which version, branch, or draft is becoming canonical',
    naturalField: 'gravity',
    primitives: ['gravity', 'memory', 'link', 'morph'],
    bodies: [
      { body: 'gravity', strength: 1.1, range: 400, feedback: true },
      { body: 'memory', strength: 0.6, range: 280 },
      { body: 'link', strength: 0.6, range: 300 },
      { body: 'morph', strength: 0.4, range: 220 },
    ],
    relationships: [{ from: 'fork', to: 'canonical', type: 'derives-from', strength: 0.6 }],
    render: ['metaballs', 'links', 'field-lines', 'particles'],
    metrics: ['version-weight', 'recency', 'approval', 'fork-distance'],
    diagnostics: ['topology', 'potential', 'causality'],
    accessibility: {
      reducedMotion: 'a version tree with a canonical badge and a fork list',
      meaningWithoutMotion: 'versions form a tree; the canonical one carries a badge and a weight, forks list their distance from it',
    },
    notes: 'Versions gain and lose mass by recency, approval, references, and edits, so the canonical draft becomes a gravity center pulling the rest while forks stay visible as related bodies that may morph toward it.',
  },
  {
    id: 'review-constellation',
    name: 'Review Constellation',
    intent: 'bind reviewers, comments, issues, and artifacts into one field',
    naturalField: 'strong',
    primitives: ['link', 'charge', 'cohesion', 'pressure', 'memory'],
    bodies: [
      { body: 'link', strength: 1, range: 340, feedback: true },
      { body: 'charge', strength: 0.7, range: 300, spin: 1 },
      { body: 'cohesion', strength: 0.7, range: 300 },
      { body: 'pressure', strength: 0.6, range: 260 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    relationships: [{ from: 'reviewer', to: 'artifact', type: 'reviews', strength: 0.7 }],
    render: ['links', 'field-lines', 'heatmap', 'particles'],
    metrics: ['review', 'tension', 'resolution', 'attention'],
    diagnostics: ['topology', 'causality', 'heatmap'],
    accessibility: {
      reducedMotion: 'a reviewer matrix with issue clusters and an unresolved-count rail',
      meaningWithoutMotion: 'reviewers, comments, issues, and artifacts form a labelled matrix with an unresolved count per cluster',
    },
    notes: 'Reviewers, comments, issues, and artifacts bind into one constellation: open issues hold tension, resolved comments cool into memory, and a reviewer in focus emits current to the artifact (the strong bind holds it, charge marks active focus).',
  },
  {
    id: 'anomaly-bloom',
    name: 'Anomaly Bloom',
    intent: 'surface unusual behavior as local heat and instability',
    naturalField: 'weak',
    primitives: ['thermal', 'diffuse', 'pressure', 'morph', 'memory'],
    bodies: [
      { body: 'thermal', strength: 1, range: 320, feedback: true },
      { body: 'diffuse', strength: 0.7, range: 300 },
      { body: 'pressure', strength: 0.6, range: 260 },
      { body: 'morph', strength: 0.4, range: 220 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    render: ['heatmap', 'metaballs', 'particles'],
    metrics: ['anomaly', 'heat', 'spread', 'confidence'],
    diagnostics: ['heatmap', 'contours', 'energy', 'causality'],
    accessibility: {
      reducedMotion: 'anomaly badges with an affected-region list and a severity gradient',
      meaningWithoutMotion: 'each anomaly is a labelled badge with a severity value and the region it affects, ranked by heat',
    },
    notes: 'Anomalies bloom locally as thermal heat that diffuses outward; they never auto-alarm, instead letting heat, pressure, and spread reveal whether the event is isolated, growing, or cooling into memory (the weak interaction is the local instability that lets behavior morph).',
  },
  {
    id: 'scope-lens',
    name: 'Scope Lens',
    intent: 'reveal what a component, recipe, or action can affect',
    primitives: ['link', 'wall', 'lens'],
    bodies: [
      { body: 'link', strength: 0.8, range: 340, feedback: true },
      { body: 'wall', strength: 0.6, range: 280 },
      { body: 'lens', strength: 0.5, range: 300 },
    ],
    relationships: [{ from: 'action', to: 'target', type: 'can-affect', strength: 0.6 }],
    render: ['links', 'field-lines', 'voronoi', 'particles'],
    metrics: ['scope', 'impact', 'risk', 'relation-strength'],
    diagnostics: ['topology', 'inspector', 'causality'],
    accessibility: {
      reducedMotion: 'an affected-item table with an impact list and a scope outline',
      meaningWithoutMotion: 'activating the lens lists every item an action can affect in a table, each with a relation strength',
    },
    notes: 'A diagnostic overlay, not a field of its own: links trace what an action can reach, walls mark where its scope stops, and the lens focuses the view on reach before mutation. It reads the relationship graph rather than translating a natural field.',
  },
  {
    id: 'calibration-field',
    name: 'Calibration Field',
    intent: 'help users tune settings toward a stable target',
    naturalField: 'gravity',
    primitives: ['gravity', 'cohesion', 'pressure', 'memory'],
    bodies: [
      { body: 'gravity', strength: 1, range: 400, feedback: true },
      { body: 'cohesion', strength: 0.7, range: 300 },
      { body: 'pressure', strength: 0.6, range: 260 },
      { body: 'memory', strength: 0.4, range: 260 },
    ],
    render: ['metaballs', 'field-lines', 'heatmap', 'particles'],
    metrics: ['calibration', 'distance', 'coherence', 'pressure'],
    diagnostics: ['potential', 'prediction', 'inspector'],
    accessibility: {
      reducedMotion: 'a target meter with a stability marker and a recommended range',
      meaningWithoutMotion: 'the target is a labelled meter; current config shows its distance and whether it sits in the recommended range',
    },
    notes: 'A target state sits as a stable gravity well: as the user tunes, the current config moves toward or away from coherence, and over-tuned or contradictory settings add pressure that pushes it back out.',
  },
  {
    id: 'semantic-drag',
    name: 'Semantic Drag',
    intent: 'add resistance when movement would break meaning',
    primitives: ['viscosity', 'link', 'tether', 'cohesion'],
    bodies: [
      { body: 'viscosity', strength: 0.9, range: 300, feedback: true },
      { body: 'link', strength: 0.7, range: 320 },
      { body: 'tether', strength: 0.6, range: 280 },
      { body: 'cohesion', strength: 0.5, range: 260 },
    ],
    relationships: [{ from: 'object', to: 'neighbor', type: 'meaningful-with', strength: 0.6 }],
    render: ['links', 'field-lines', 'trails', 'particles'],
    metrics: ['drag', 'validity', 'relation-strength', 'friction'],
    diagnostics: ['force-vectors', 'topology', 'prediction'],
    accessibility: {
      reducedMotion: 'valid/invalid guides with relation warnings and a drop-cost marker',
      meaningWithoutMotion: 'valid drop targets are listed; invalid moves show a warning and a labelled cost before commit',
    },
    notes: 'A derived friction recipe, not a natural field: dragging an object away from meaningful neighbors thickens viscosity while tether (spring) and links resist, and moving toward a valid relationship lets resistance fall away. The user can always override.',
  },
  {
    id: 'recovery-path',
    name: 'Recovery Path',
    intent: 'guide users back from error, drift, or interrupted state',
    naturalField: 'weak',
    primitives: ['memory', 'morph', 'link', 'fieldflow', 'gravity'],
    bodies: [
      { body: 'memory', strength: 1, range: 320, feedback: true },
      { body: 'morph', strength: 0.6, range: 240 },
      { body: 'link', strength: 0.6, range: 300 },
      { body: 'fieldflow', strength: 0.7, range: 0 },
      { body: 'gravity', strength: 0.6, range: 360 },
    ],
    relationships: [{ from: 'state', to: 'last-stable', type: 'restores-to', strength: 0.7 }],
    render: ['field-lines', 'streamlines', 'links', 'particles'],
    metrics: ['recovery', 'memory', 'last-stable', 'confidence'],
    diagnostics: ['heatmap', 'prediction', 'causality'],
    accessibility: {
      reducedMotion: 'a recovery checklist with a last-good-state marker and a restore path',
      meaningWithoutMotion: 'the last coherent state is marked and recovery is an ordered checklist back to it, not a generic error screen',
    },
    notes: 'When a process fails or interrupts, memory holds the last coherent path while gravity pulls the user back toward it and fieldflow carries them along the guided return, morphing the broken state back into a stable one.',
  },
  {
    id: 'system-pulse',
    name: 'System Pulse',
    intent: 'show the living rhythm of a product, workflow, or data system',
    naturalField: 'electromagnetic',
    primitives: ['propagate', 'thermal', 'memory', 'cohesion', 'spawn'],
    bodies: [
      { body: 'propagate', strength: 0.9, range: 400, feedback: true },
      { body: 'thermal', strength: 0.6, range: 300 },
      { body: 'memory', strength: 0.5, range: 260 },
      { body: 'cohesion', strength: 0.5, range: 280 },
      { body: 'spawn', strength: 0.5, range: 240 },
    ],
    render: ['field-lines', 'heatmap', 'streamlines', 'particles'],
    metrics: ['pulse', 'health', 'sync', 'heat'],
    diagnostics: ['energy', 'contours', 'inspector'],
    accessibility: {
      reducedMotion: 'a health rail with a pulse timestamp and a static system-status indicator',
      meaningWithoutMotion: 'system health is a labelled status indicator with a last-pulse timestamp and a sync state',
    },
    notes: 'The system emits a low-frequency pulse that propagates as an ambient heartbeat, thermal heat reflecting live activity while cohesion reads sync and memory holds the trend, the emitter (spawn) issuing each beat without distracting from content.',
  },
];

// ── lane data layered onto the records by id ────────────────────────────────────────
// The records above carry the strict runtime lanes (primitives / metrics / diagnostics). CONCEPTS and
// CONDITIONS add the two remaining lanes — product language and activation logic — without polluting
// the token data. A word here is deliberately NOT a runtime token (orbit, spring, trust, dwell, stale).

/** CONCEPTS lane — human-facing product language per recipe (never runtime tokens). */
const CONCEPTS: Readonly<Record<string, readonly string[]>> = {
  'focus-orbit': ['orbit'],
  'search-relevance-field': ['relevance'],
  'availability-pressure': ['spring'],
  'dependency-tension': ['spring'],
  'drift-correction': ['spring'],
  'semantic-snap': ['spring'],
  'semantic-drag': ['drag', 'spring'],
  'friction-gate': ['drag', 'friction'],
  'boundary-field': ['reflect', 'absorb'],
  'permission-boundary': ['reflect', 'absorb'],
  'threshold-bloom': ['threshold', 'bloom'],
  'decay-notice': ['decay'],
  'staleness-drift': ['staleness', 'decay'],
  'memory-trace': ['decay'],
  'handoff-stream': ['handoff'],
  'trust-gradient': ['trust'],
  'consensus-well': ['consensus'],
  'disagreement-charge': ['disagreement'],
  'system-pulse': ['pulse', 'heartbeat'],
  'review-pressure': ['review pressure'],
  'review-constellation': ['constellation'],
  'conflict-field': ['conflict'],
  'phase-shift': ['phase shift'],
  'completion-release': ['completion', 'release'],
  'risk-horizon': ['risk horizon'],
  'change-shockwave': ['shockwave', 'blast radius'],
  'anomaly-bloom': ['anomaly', 'bloom'],
  'version-gravity': ['canonical version'],
  'provenance-trail': ['provenance', 'lineage'],
  'latency-ripple': ['ripple'],
  'attention-weather': ['weather'],
  'selection-wake': ['wake'],
  'semantic-gravity-map': ['semantic mass'],
  'presence-field': ['presence'],
  'scope-lens': ['scope'],
  'field-contract-preview': ['contract'],
  'diagnostic-lens': ['inspectability'],
  'priority-tide': ['tide'],
};

/** CONDITIONS lane — activation logic per recipe (never runtime tokens). */
const CONDITIONS: Readonly<Record<string, readonly string[]>> = {
  'priority-well': ['in-view'],
  'focus-orbit': ['focused', 'related'],
  'search-relevance-field': ['related'],
  'reading-field': ['in-view', 'dwell'],
  'ambient-tutor': ['dwell', 'return'],
  'context-halo': ['focused'],
  'command-intent-field': ['focused'],
  'intent-magnet': ['focused'],
  'selection-wake': ['selected'],
  'staleness-drift': ['stale'],
  'drift-correction': ['stale'],
  'decay-notice': ['stale'],
  'recovery-path': ['stale'],
  'review-pressure': ['stale'],
  'friction-gate': ['threshold', 'dwell'],
  'threshold-bloom': ['threshold'],
  'anomaly-bloom': ['threshold'],
  'risk-horizon': ['threshold'],
  'calibration-field': ['threshold'],
  'trust-gradient': ['trusted'],
  'conflict-field': ['conflicted'],
  'disagreement-charge': ['conflicted'],
  'relationship-bond': ['related'],
  'evidence-field': ['related'],
  'citation-thread': ['related'],
  'review-constellation': ['related'],
  'semantic-snap': ['related'],
  'semantic-drag': ['related'],
};

/** Layer tier + status + the concept/condition lanes onto a tier's raw records. */
const decorate = (recipes: readonly FieldRecipe[], tier: RecipeTier): FieldRecipe[] =>
  recipes.map((r) => ({
    ...r,
    tier,
    status: r.status ?? 'shipped',
    ...(CONCEPTS[r.id] ? { concepts: [...CONCEPTS[r.id]!] } : {}),
    ...(CONDITIONS[r.id] ? { conditions: [...CONDITIONS[r.id]!] } : {}),
  }));

export interface RecipeTierGroup {
  key: RecipeTier;
  label: string;
  recipes: readonly FieldRecipe[];
}

/** The four catalog tiers, in order — the navigable structure over {@link FIELD_RECIPES}. */
export const RECIPE_TIERS: readonly RecipeTierGroup[] = [
  { key: 'core', label: 'Core interface & accessibility', recipes: decorate(TIER_CORE, 'core') },
  { key: 'workflow', label: 'Product, workflow & collaboration', recipes: decorate(TIER_PRODUCT, 'workflow') },
  { key: 'professional', label: 'Professional systems & governance', recipes: decorate(TIER_SYSTEMS, 'professional') },
  { key: 'enterprise', label: 'Enterprise, adaptive & operational', recipes: decorate(TIER_ENTERPRISE, 'enterprise') },
];

/** The full field-recipe catalog (authoring §7) — 64 recipes across four tiers, in catalog order. */
export const FIELD_RECIPES: readonly FieldRecipe[] = RECIPE_TIERS.flatMap((t) => t.recipes);

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
