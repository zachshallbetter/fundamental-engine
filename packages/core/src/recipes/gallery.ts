/**
 * The essential recipe gallery (authoring-and-recipes §7). A curated set of portable SceneRecipes
 * that double as worked examples and conformance fixtures. Every token is a real, passported force,
 * so `validateRecipe` passes for all of them (the gallery test enforces this).
 */
import type { SceneRecipe } from './schema.ts';

export const LIVING_HEADLINE: SceneRecipe = {
  name: 'Living Headline',
  intent: 'a headline that gains weight and glow where the field gathers',
  bodies: [{ body: 'attract', strength: 1.2, range: 320, feedback: true }],
  render: ['particles', 'trails'],
  metrics: ['density', 'attention'],
  accessibility: { reducedMotion: 'weight/glow hold their last value; no travel', meaningWithoutMotion: 'the heading is live HTML text' },
  notes: 'Density writes back as --field-density, driving font weight and bloom.',
};

export const ATTENTION_BUDGET: SceneRecipe = {
  name: 'Attention Budget',
  intent: 'one finite attention budget across competing items',
  bodies: [
    { body: 'attract', strength: 1, range: 240, feedback: true },
    { body: 'cohesion', strength: 0.4, range: 200, scope: 'global' },
  ],
  render: ['particles'],
  metrics: ['attention', 'density'],
  accessibility: { reducedMotion: 'attention shown as static emphasis', meaningWithoutMotion: 'focused item gets an outline + label' },
  notes: 'Engaging one item pulls attention off the others (conserved budget).',
};

export const RELATIONSHIP_MAP: SceneRecipe = {
  name: 'Relationship Map',
  intent: 'show active connections that strengthen with use',
  bodies: [{ body: 'memory', strength: 0.8, range: 360, feedback: true }],
  relationships: [{ from: 'a', to: 'b', type: 'cites', strength: 0.5 }],
  render: ['links', 'particles'],
  metrics: ['memory', 'coherence'],
  accessibility: { reducedMotion: 'links render statically', meaningWithoutMotion: 'connections are also listed as text' },
  notes: 'RelationshipAgents strengthen on use and decay over time.',
};

export const SOLAR_PROMINENCE: SceneRecipe = {
  name: 'Solar Prominence',
  intent: 'field-aligned plasma stream',
  bodies: [
    { body: 'magnetism', strength: 1.2, range: 420 },
    { body: 'fieldflow', strength: 0.8, range: 0 },
    { body: 'thermal', strength: 0.2, range: 320 },
  ],
  render: ['particles', 'field-lines', 'trails', 'heatmap'],
  metrics: ['heat', 'entropy'],
  accessibility: { reducedMotion: 'static field lines replace the moving stream', meaningWithoutMotion: 'decorative — aria-hidden' },
  expected: { entropyRange: [0.1, 0.4] },
  notes: 'Magnetism defines the loops; fieldflow carries neutral matter along them.',
};

export const FORM_VALIDATION_FIELD: SceneRecipe = {
  name: 'Form Validation Field',
  intent: 'a form whose coherence rises as it becomes valid',
  bodies: [
    { body: 'cohesion', strength: 0.7, range: 260, feedback: true },
    { body: 'repel', strength: 0.5, range: 180 },
  ],
  render: ['particles'],
  metrics: ['coherence', 'entropy'],
  accessibility: { reducedMotion: 'coherence shown as a static state class', meaningWithoutMotion: 'validity is announced + shown with icon/text' },
  notes: 'Invalid fields raise entropy (repel); a valid form settles into coherence.',
};

export const AI_CONFIDENCE_FIELD: SceneRecipe = {
  name: 'AI Confidence Field',
  intent: 'render model confidence as field clarity',
  bodies: [
    { body: 'cohesion', strength: 0.9, range: 300, feedback: true },
    { body: 'thermal', strength: 0.3, range: 240 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['coherence', 'entropy', 'heat'],
  accessibility: { reducedMotion: 'confidence shown as a static clarity/blur token', meaningWithoutMotion: 'confidence is also a numeric label' },
  notes: 'High confidence → coherent, clear; low confidence → thermal noise, higher entropy.',
};

export const SEARCH_RELEVANCE_WELLS: SceneRecipe = {
  name: 'Search Relevance Wells',
  intent: 'results settle into wells by relevance; excluded ones drift out',
  bodies: [
    { body: 'attract', strength: 1, range: 280, feedback: true },
    { body: 'repel', strength: 0.6, range: 200 },
  ],
  render: ['particles'],
  metrics: ['density', 'attention', 'entropy'],
  accessibility: { reducedMotion: 'results re-rank statically', meaningWithoutMotion: 'ranking is also a numbered list' },
  notes: 'Relevance → attract strength; formation scatter → wells as a query resolves.',
};

export const READING_MEMORY_TRAIL: SceneRecipe = {
  name: 'Reading Memory Trail',
  intent: 'read paragraphs leave a warm memory trail; the viewport centre is an attention well',
  bodies: [
    { body: 'attract', strength: 0.8, range: 300, feedback: true },
    { body: 'memory', strength: 0.7, range: 360 },
  ],
  render: ['trails', 'particles'],
  metrics: ['memory', 'attention'],
  accessibility: { reducedMotion: 'the trail renders statically', meaningWithoutMotion: 'progress shown as a read-state marker' },
  notes: 'Memory accumulates along the reading path and amplifies future attention.',
};

export const COLLABORATIVE_PRESENCE: SceneRecipe = {
  name: 'Collaborative Presence',
  intent: 'collaborators are auras; agreement coheres, conflict repels, edits deposit heat',
  bodies: [
    { body: 'cohesion', strength: 0.6, range: 260, feedback: true },
    { body: 'repel', strength: 0.5, range: 180 },
    { body: 'thermal', strength: 0.3, range: 220 },
  ],
  render: ['particles', 'heatmap'],
  metrics: ['coherence', 'heat', 'entropy'],
  accessibility: { reducedMotion: 'presence shown as static avatars/markers', meaningWithoutMotion: 'collaborators are listed with status' },
  notes: 'Agreement → cohesion, conflict → repel, edits → thermal heat deposits.',
};

/** The full gallery (authoring §7 essential recipes). */
export const ESSENTIAL_RECIPES: readonly SceneRecipe[] = [
  LIVING_HEADLINE,
  ATTENTION_BUDGET,
  RELATIONSHIP_MAP,
  SOLAR_PROMINENCE,
  FORM_VALIDATION_FIELD,
  AI_CONFIDENCE_FIELD,
  SEARCH_RELEVANCE_WELLS,
  READING_MEMORY_TRAIL,
  COLLABORATIVE_PRESENCE,
];
