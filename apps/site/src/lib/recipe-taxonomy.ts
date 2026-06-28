// recipe-taxonomy.ts — the discovery layer for /explore.
//
// The 64 recipes live in @fundamental-engine/core (catalog.ts) — that is the frozen source of
// truth and feeds the native ports. This file adds the *discovery* metadata the engine catalog
// deliberately doesn't carry: which user-intent domains a recipe answers, the concrete things it
// solves, an optional preview scaffold, and an optional hand-authored snippet.
//
// DB-READY SHAPE: every entry is a flat row keyed by recipe id. `domains` and `solves` are arrays
// (→ join tables or text[] columns); everything else is a scalar. A seed script can push this
// straight into Neon when dynamic features (analytics, contributions, search API) justify the
// infra — see docs/design/explore-interaction-model.md §6. Until then it ships as versioned TS:
// no infra to build the site, runs in e2e, works offline.
//
// What is NOT here (derived from the recipe object at runtime, never duplicated):
//   • viz render modes      ← recipe.render[]
//   • diagnostic overlays   ← recipe.diagnostics[]
//   • measured signals      ← recipe.metrics[]
//   • reduced-motion text   ← recipe.accessibility

/** The nine user-intent domains — the primary filter. A recipe answers one or more. */
export type ProblemDomain =
  | 'priority'
  | 'navigation'
  | 'relationships'
  | 'evidence'
  | 'conflict'
  | 'memory'
  | 'flow'
  | 'presence'
  | 'governance';

/** Domain display metadata — order here is the order pills render in the filter bar. */
export interface DomainMeta {
  id: ProblemDomain;
  /** full pill label / detail-panel tag */
  label: string;
  /** compact pill label for the filter bar (the first word) */
  short: string;
  /** the arrival question, shown under the label / as a tooltip */
  need: string;
  /** css custom-property name carrying the domain accent (defined in explore.css) */
  accentVar: string;
}

export const DOMAINS: readonly DomainMeta[] = [
  { id: 'priority',      label: 'Priority & Attention',     short: 'Priority',      need: 'show what matters / what’s urgent',       accentVar: '--dom-priority' },
  { id: 'navigation',    label: 'Navigation & Wayfinding',  short: 'Navigation',    need: 'orient the user & guide them',             accentVar: '--dom-navigation' },
  { id: 'relationships', label: 'Relationships & Structure', short: 'Relationships', need: 'connect, cluster, show dependencies',     accentVar: '--dom-relationships' },
  { id: 'evidence',      label: 'Evidence & Trust',         short: 'Evidence',      need: 'show support, provenance, confidence',     accentVar: '--dom-evidence' },
  { id: 'conflict',      label: 'Conflict & Stability',     short: 'Conflict',      need: 'surface contradiction / instability',      accentVar: '--dom-conflict' },
  { id: 'memory',        label: 'Memory & Time',            short: 'Memory',        need: 'show recency, decay, transitions',         accentVar: '--dom-memory' },
  { id: 'flow',          label: 'Flow & Process',           short: 'Flow',          need: 'multi-step, handoff, recovery',            accentVar: '--dom-flow' },
  { id: 'presence',      label: 'Presence & System Health', short: 'Presence',      need: 'live activity, collaborators, status',     accentVar: '--dom-presence' },
  { id: 'governance',    label: 'Safety & Governance',      short: 'Safety',        need: 'show what’s protected / risky / scoped',    accentVar: '--dom-governance' },
] as const;

/** One discovery row per recipe. */
export interface RecipeTaxonomy {
  /** user-intent domains, primary first — drives the filter + the card accent */
  domains: ProblemDomain[];
  /** 2–4 concrete things this recipe is used for (developer language, not engine language) */
  solves: string[];
  /** id of a representative scaffold in recipe-scaffolds.ts; falls back to generic if omitted */
  scaffoldId?: string;
  /** which of the recipe's render layers the expanded view wakes into; defaults to render[0] */
  primaryRender?: string;
  /** optional hand-authored copy-paste snippet; if omitted the workbench generates one from bodies */
  snippetOverride?: string;
}

/**
 * Platform / teaching recipes — genuine engine-meta, NOT a problem domain. Surfaced in a separate
 * "Platform & Teaching" group, framed as "understand / instrument the engine."
 * (The other no-naturalField recipes — friction-gate, scope-lens, semantic-drag — are real
 * interaction recipes and appear in TAXONOMY below with real domains.)
 */
export const PLATFORM_RECIPES: readonly string[] = [
  'diagnostic-lens',
  'field-tutorial',
  'field-contract-preview',
  'accessibility-equivalence',
] as const;

/**
 * The discovery map. Every one of the 64 recipes appears here (platform recipes too, with an
 * empty domains array so the data stays total). `solves` is derived from each recipe's real intent.
 */
export const TAXONOMY: Record<string, RecipeTaxonomy> = {
  // ── Core / first-release ──────────────────────────────────────────────────────────────────
  'priority-well':         { domains: ['priority'], solves: ['task lists', 'content feeds', 'notification stacks'], scaffoldId: 'priority-well' },
  'focus-orbit':           { domains: ['navigation', 'priority'], solves: ['option menus', 'related actions', 'tool palettes'], scaffoldId: 'focus-orbit' },
  'search-relevance-field': { domains: ['priority', 'evidence'], solves: ['search results', 'ranked feeds', 'recommendation lists'], scaffoldId: 'search-relevance-field' },
  'signal-path':           { domains: ['relationships', 'flow'], solves: ['citation graphs', 'dependency chains', 'route maps'], scaffoldId: 'signal-path' },
  'evidence-field':        { domains: ['evidence', 'relationships'], solves: ['claims & sources', 'fact-checks', 'research notes'], scaffoldId: 'evidence-field' },
  'conflict-field':        { domains: ['conflict'], solves: ['contested edits', 'merge conflicts', 'uncertain state'], scaffoldId: 'conflict-field' },
  'relationship-bond':     { domains: ['relationships'], solves: ['linked records', 'related cards', 'service maps'], scaffoldId: 'relationship-bond' },
  'concept-cluster':       { domains: ['relationships'], solves: ['tag groups', 'topic maps', 'section grouping'], scaffoldId: 'concept-cluster' },
  'coherence-field':       { domains: ['conflict', 'flow'], solves: ['form validation', 'workflow health', 'dataset stability'], scaffoldId: 'coherence-field' },
  'reading-field':         { domains: ['navigation', 'memory', 'priority'], solves: ['long articles', 'documentation', 'reading progress'], scaffoldId: 'reading-field' },
  'memory-trace':          { domains: ['memory'], solves: ['visited history', 'attention trails', 'return paths'], scaffoldId: 'memory-trace' },
  'decay-notice':          { domains: ['memory'], solves: ['stale banners', 'expiring items', 'completed state'], scaffoldId: 'decay-notice' },
  'phase-shift':           { domains: ['memory', 'flow'], solves: ['draft → published', 'pending → complete', 'status changes'] },
  'guided-flow':           { domains: ['flow', 'navigation'], solves: ['onboarding paths', 'wizards', 'guided tours'], scaffoldId: 'guided-flow' },

  // ── Platform / teaching (no problem domain) ──────────────────────────────────────────────
  'diagnostic-lens':       { domains: [], solves: ['debugging fields', 'force inspection', 'teaching the engine'] },
  'field-tutorial':        { domains: [], solves: ['learn Fundamental', 'guided walkthrough', 'concept demo'] },
  'accessibility-equivalence': { domains: [], solves: ['reduced-motion fallbacks', 'semantic equivalents', 'a11y parity'] },

  // ── Applied — product / workflow / collaboration ─────────────────────────────────────────
  'attention-weather':     { domains: ['priority', 'presence'], solves: ['dashboards', 'ops boards', 'activity overviews'], scaffoldId: 'attention-weather' },
  'navigation-current':    { domains: ['navigation'], solves: ['breadcrumbs', 'route hints', 'next-step nav'], scaffoldId: 'navigation-current' },
  'citation-thread':       { domains: ['evidence', 'relationships'], solves: ['footnotes', 'reference lists', 'linked evidence'], scaffoldId: 'citation-thread' },
  'form-stability-field':  { domains: ['flow', 'conflict'], solves: ['form validation', 'multi-field checks', 'progressive forms'], scaffoldId: 'form-stability-field' },
  'command-intent-field':  { domains: ['navigation', 'priority'], solves: ['command palettes', 'quick switchers', 'action search'], scaffoldId: 'command-intent-field' },
  'selection-wake':        { domains: ['memory'], solves: ['selection trails', 'recent picks', 'interaction history'], scaffoldId: 'selection-wake' },
  'availability-pressure': { domains: ['presence', 'priority'], solves: ['calendars', 'scheduling', 'capacity views'], scaffoldId: 'availability-pressure' },
  'dependency-tension':    { domains: ['relationships', 'conflict'], solves: ['blocked tasks', 'coupled state', 'constraint graphs'], scaffoldId: 'dependency-tension' },
  'staleness-drift':       { domains: ['memory'], solves: ['outdated files', 'stale data', 'aging content'], scaffoldId: 'staleness-drift' },
  'trust-gradient':        { domains: ['evidence'], solves: ['verified badges', 'confidence levels', 'unsupported claims'], scaffoldId: 'trust-gradient' },
  'completion-release':    { domains: ['memory', 'flow'], solves: ['done tasks', 'finished work', 'archive transitions'], scaffoldId: 'completion-release' },
  'group-magnet':          { domains: ['relationships'], solves: ['card clustering', 'asset grouping', 'smart bins'], scaffoldId: 'group-magnet' },
  'error-pressure':        { domains: ['conflict'], solves: ['error accumulation', 'instability signals', 'soft alerts'], scaffoldId: 'error-pressure' },
  'handoff-stream':        { domains: ['flow', 'presence'], solves: ['ownership transfer', 'state passing', 'assignment flow'], scaffoldId: 'handoff-stream' },
  'context-halo':          { domains: ['priority', 'navigation'], solves: ['related context', 'focus surroundings', 'inline detail'] },
  'semantic-gravity-map':  { domains: ['priority', 'relationships'], solves: ['concept weight', 'document maps', 'idea importance'] },
  'polarity-filter':       { domains: ['conflict', 'relationships'], solves: ['opposing tags', 'preference sorting', 'for/against views'], scaffoldId: 'polarity-filter' },
  'source-constellation':  { domains: ['evidence', 'relationships'], solves: ['multi-source claims', 'topic sources', 'decision inputs'] },
  'drift-correction':      { domains: ['conflict', 'navigation'], solves: ['wandering attention', 'layout reflow', 'focus recovery'] },
  'resonance-match':       { domains: ['priority', 'navigation'], solves: ['intent matching', 'live highlights', 'relevant surfacing'] },

  // ── Systems — safety / provenance / governance ───────────────────────────────────────────
  'friction-gate':         { domains: ['governance'], solves: ['destructive actions', 'irreversible steps', 'confirm-without-modal'] },
  'boundary-field':        { domains: ['governance', 'relationships'], solves: ['drop zones', 'safe scopes', 'containers'] },
  'threshold-bloom':       { domains: ['memory', 'priority'], solves: ['threshold alerts', 'milestone reveals', 'goal crossings'], scaffoldId: 'threshold-bloom' },
  'latency-ripple':        { domains: ['presence', 'flow'], solves: ['loading state', 'sync delay', 'distributed response'] },
  'provenance-trail':      { domains: ['evidence', 'memory'], solves: ['content origin', 'edit history', 'data lineage'], scaffoldId: 'provenance-trail' },
  'review-pressure':       { domains: ['priority', 'conflict'], solves: ['review queues', 'expiring approvals', 'blocking items'], scaffoldId: 'review-pressure' },
  'semantic-snap':         { domains: ['relationships'], solves: ['meaning-aligned layout', 'smart alignment', 'content snapping'] },
  'ambient-tutor':         { domains: ['navigation', 'memory'], solves: ['contextual help', 'hesitation hints', 'quiet onboarding'] },
  'relation-lens':         { domains: ['relationships'], solves: ['reveal-on-hover links', 'hidden connections', 'graph peek'] },
  'priority-tide':         { domains: ['priority', 'memory'], solves: ['shifting importance', 'workload tides', 'temporal priority'] },
  'field-contract-preview': { domains: [], solves: ['recipe inspection', 'pre-enable preview', 'contract disclosure'] },
  'semantic-drag':         { domains: ['flow', 'relationships'], solves: ['meaning-preserving drag', 'safe reordering', 'constrained moves'] },
  'scope-lens':            { domains: ['governance'], solves: ['blast-radius preview', 'affected scope', 'impact reveal'] },

  // ── Operational — multi-actor / adaptive / live ──────────────────────────────────────────
  'presence-field':        { domains: ['presence'], solves: ['live collaborators', 'cursors', 'who’s-here'], scaffoldId: 'presence-field' },
  'consensus-well':        { domains: ['presence', 'conflict'], solves: ['voting', 'agreement gathering', 'decision convergence'], scaffoldId: 'consensus-well' },
  'disagreement-charge':   { domains: ['conflict', 'presence'], solves: ['open disputes', 'split decisions', 'unresolved threads'] },
  'change-shockwave':      { domains: ['flow', 'presence'], solves: ['downstream impact', 'change propagation', 'ripple effects'] },
  'permission-boundary':   { domains: ['governance'], solves: ['access scopes', 'protected regions', 'role boundaries'] },
  'risk-horizon':          { domains: ['governance', 'priority'], solves: ['approaching risk', 'early warnings', 'pre-error signals'] },
  'intent-magnet':         { domains: ['navigation', 'priority'], solves: ['likely actions', 'contextual shortcuts', 'predicted intent'] },
  'flow-checkpoint':       { domains: ['flow'], solves: ['milestones', 'multi-step stability', 'save points'] },
  'version-gravity':       { domains: ['memory', 'presence'], solves: ['canonical version', 'branch selection', 'draft promotion'] },
  'review-constellation':  { domains: ['relationships', 'presence'], solves: ['review threads', 'comment binding', 'artifact gathering'] },
  'anomaly-bloom':         { domains: ['conflict', 'presence'], solves: ['anomaly detection', 'unusual activity', 'local instability'], scaffoldId: 'anomaly-bloom' },
  'calibration-field':     { domains: ['flow'], solves: ['settings tuning', 'target seeking', 'parameter sliders'] },
  'recovery-path':         { domains: ['flow', 'conflict'], solves: ['error recovery', 'interrupted flows', 'undo paths'] },
  'system-pulse':          { domains: ['presence'], solves: ['system rhythm', 'live health', 'heartbeat views'] },
};

/** All domain ids in render order. */
export const DOMAIN_IDS: readonly ProblemDomain[] = DOMAINS.map((d) => d.id);

/** Lookup with a safe fallback so callers never crash on an unmapped id. */
export function taxonomyFor(id: string): RecipeTaxonomy {
  return TAXONOMY[id] ?? { domains: [], solves: [] };
}

/** Is this recipe a platform / teaching recipe (vs a problem-domain recipe)? */
export function isPlatformRecipe(id: string): boolean {
  return PLATFORM_RECIPES.includes(id);
}
