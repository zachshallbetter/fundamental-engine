// recipe-scaffolds.ts — per-recipe HTML templates injected into preview cards
// before applyPattern() runs, so visitors see actual UI elements reacting to the
// field rather than an empty particle box.
//
// Each scaffold is a small fragment of representative UI: 3-5 labeled elements
// with data-body attributes matching the recipe's primitives, plus data-feedback
// on elements that should visually respond (glow, weight, color) as the field runs.
//
// Recipes not listed here fall back to the generic 3-body scaffold below.
// Shared styling is injected once by initRecipePreviews via injectScaffoldStyles().

const SC = (html: string) => html.trim();

// ── First-release recipes ────────────────────────────────────────────────────

const PRIORITY_WELL = SC(`
  <span class="sc-item sc-hi" data-body="attract gravity" data-strength="1.4" data-feedback>Critical task</span>
  <span class="sc-item" data-body="attract" data-strength="0.7" data-feedback>Normal task</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.2" data-feedback>Low priority</span>
`);

const SIGNAL_PATH = SC(`
  <span class="sc-node sc-source" data-body="charge" data-strength="1.1" data-feedback>Source</span>
  <span class="sc-node sc-mid" data-body="attract" data-strength="0.4" data-feedback>Handler</span>
  <span class="sc-node sc-dest" data-body="gravity" data-strength="1.3" data-feedback>Output</span>
`);

const RELATIONSHIP_BOND = SC(`
  <span class="sc-node" data-body="cohesion" data-strength="0.9" data-feedback>API</span>
  <span class="sc-node" data-body="cohesion" data-strength="0.9" data-feedback>Database</span>
  <span class="sc-node sc-lo" data-body="cohesion" data-strength="0.5" data-feedback>Cache</span>
`);

const READING_FIELD = SC(`
  <p class="sc-text sc-lo" data-body="attract" data-strength="0.3" data-feedback>Intro paragraph — context, framing</p>
  <p class="sc-text sc-hi" data-body="attract" data-strength="1.0" data-feedback>Key insight — the idea that carries weight</p>
  <p class="sc-text sc-lo" data-body="attract" data-strength="0.2" data-feedback>Summary — wraps the section</p>
`);

const EVIDENCE_FIELD = SC(`
  <span class="sc-claim" data-body="attract" data-strength="1.2" data-feedback>Claim</span>
  <span class="sc-source sc-ok" data-body="charge" data-strength="0.9" data-feedback>Verified source</span>
  <span class="sc-source sc-warn" data-body="charge" data-strength="0.6" data-feedback>Partial source</span>
  <span class="sc-source sc-err" data-body="charge" data-strength="-0.4" data-feedback>Conflicting source</span>
`);

const COHERENCE_FIELD = SC(`
  <span class="sc-step sc-done" data-body="attract" data-strength="0.2" data-feedback>Name ✓</span>
  <span class="sc-step sc-active" data-body="attract gravity" data-strength="1.3" data-feedback>Email ◐</span>
  <span class="sc-step" data-body="attract" data-strength="0.5" data-feedback>Message ○</span>
`);

const MEMORY_TRACE = SC(`
  <span class="sc-mem sc-hot" data-body="attract" data-strength="1.4" data-feedback>Visited 12×</span>
  <span class="sc-mem" data-body="attract" data-strength="0.6" data-feedback>Visited 3×</span>
  <span class="sc-mem sc-cold" data-body="attract" data-strength="0.1" data-feedback>Never visited</span>
`);

const GUIDED_FLOW = SC(`
  <span class="sc-step sc-done" data-body="attract" data-strength="0.1" data-feedback>Step 1 ✓</span>
  <span class="sc-step sc-active" data-body="attract gravity" data-strength="1.4" data-feedback>Step 2 ›</span>
  <span class="sc-step" data-body="attract" data-strength="0.6" data-feedback>Step 3</span>
  <span class="sc-step sc-lo" data-body="attract" data-strength="0.3" data-feedback>Step 4</span>
`);

// ── Applied-tier recipes ─────────────────────────────────────────────────────

const ATTENTION_WEATHER = SC(`
  <span class="sc-item sc-hi" data-body="attract" data-strength="1.5" data-feedback>Trending now</span>
  <span class="sc-item" data-body="attract" data-strength="0.8" data-feedback>Active item</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.2" data-feedback>Quiet item</span>
`);

const NAVIGATION_CURRENT = SC(`
  <span class="sc-nav" data-body="attract" data-strength="0.4" data-feedback>Home</span>
  <span class="sc-nav sc-active" data-body="attract" data-strength="1.6" data-field-attention="1" data-feedback>Products</span>
  <span class="sc-nav" data-body="attract" data-strength="0.3" data-feedback>Docs</span>
  <span class="sc-nav" data-body="attract" data-strength="0.2" data-feedback>About</span>
`);

const CITATION_THREAD = SC(`
  <span class="sc-claim" data-body="attract" data-strength="1.0" data-feedback>Main claim</span>
  <span class="sc-source sc-ok" data-body="charge" data-strength="0.8" data-feedback>Source A</span>
  <span class="sc-source sc-ok" data-body="charge" data-strength="0.7" data-feedback>Source B</span>
`);

const FORM_STABILITY_FIELD = SC(`
  <span class="sc-field" data-body="attract" data-strength="0.4" data-feedback>Name</span>
  <span class="sc-field sc-active" data-body="attract gravity" data-strength="1.2" data-feedback>Email ✎</span>
  <span class="sc-field" data-body="attract" data-strength="0.3" data-feedback>Message</span>
`);

const COMMAND_INTENT_FIELD = SC(`
  <span class="sc-cmd sc-hi" data-body="attract gravity" data-strength="1.4" data-feedback>Publish</span>
  <span class="sc-cmd" data-body="attract" data-strength="0.6" data-feedback>Save draft</span>
  <span class="sc-cmd sc-lo" data-body="attract" data-strength="0.2" data-feedback>Discard</span>
`);

const SELECTION_WAKE = SC(`
  <span class="sc-item" data-body="attract" data-strength="0.5" data-feedback>Option A</span>
  <span class="sc-item sc-active" data-body="attract gravity" data-strength="1.5" data-feedback>Option B ✓</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.3" data-feedback>Option C</span>
`);

const AVAILABILITY_PRESSURE = SC(`
  <span class="sc-item sc-hi" data-body="attract charge" data-strength="1.8" data-feedback>3 left</span>
  <span class="sc-item sc-ok" data-body="attract" data-strength="0.7" data-feedback>In stock</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.2" data-feedback>Plenty</span>
`);

const DEPENDENCY_TENSION = SC(`
  <span class="sc-node" data-body="cohesion" data-strength="1.0" data-feedback>Auth</span>
  <span class="sc-node sc-hi" data-body="cohesion charge" data-strength="1.3" data-feedback>Payment</span>
  <span class="sc-node sc-lo" data-body="cohesion" data-strength="0.5" data-feedback>Email</span>
`);

const STALENESS_DRIFT = SC(`
  <span class="sc-mem sc-hot" data-body="attract" data-strength="1.2" data-feedback>Just updated</span>
  <span class="sc-mem" data-body="attract" data-strength="0.5" data-feedback>3 days ago</span>
  <span class="sc-mem sc-cold" data-body="attract" data-strength="0.05" data-feedback>2 weeks ago</span>
`);

const TRUST_GRADIENT = SC(`
  <span class="sc-source sc-hi" data-body="gravity" data-strength="1.4" data-feedback>Peer-reviewed</span>
  <span class="sc-source" data-body="gravity" data-strength="0.7" data-feedback>News outlet</span>
  <span class="sc-source sc-lo" data-body="gravity" data-strength="0.2" data-feedback>Anonymous post</span>
`);

const COMPLETION_RELEASE = SC(`
  <span class="sc-step sc-done" data-body="attract" data-strength="0.1" data-feedback>Draft ✓</span>
  <span class="sc-step sc-done" data-body="attract" data-strength="0.1" data-feedback>Review ✓</span>
  <span class="sc-step sc-active" data-body="gravity" data-strength="1.5" data-feedback>Publish →</span>
`);

const ERROR_PRESSURE = SC(`
  <span class="sc-field sc-err" data-body="attract charge" data-strength="1.8" data-feedback>Email ⚠</span>
  <span class="sc-field" data-body="attract" data-strength="0.3" data-feedback>Name</span>
  <span class="sc-field" data-body="attract" data-strength="0.3" data-feedback>Message</span>
`);

const HANDOFF_STREAM = SC(`
  <span class="sc-node sc-source" data-body="charge" data-strength="1.0" data-feedback>Alice</span>
  <span class="sc-node sc-mid" data-body="attract" data-strength="0.6" data-feedback>In review</span>
  <span class="sc-node sc-dest" data-body="gravity" data-strength="1.2" data-feedback>Bob</span>
`);

const PRESENCE_FIELD = SC(`
  <span class="sc-avatar sc-hi" data-body="attract" data-strength="1.1" data-feedback>Z</span>
  <span class="sc-avatar" data-body="attract" data-strength="0.8" data-feedback>A</span>
  <span class="sc-avatar sc-lo" data-body="attract" data-strength="0.3" data-feedback>B</span>
`);

const CONSENSUS_WELL = SC(`
  <span class="sc-item sc-hi" data-body="gravity" data-strength="1.5" data-feedback>Agree ×5</span>
  <span class="sc-item" data-body="gravity" data-strength="0.6" data-feedback>Neutral ×2</span>
  <span class="sc-item sc-err" data-body="charge" data-strength="-0.8" data-feedback>Disagree ×1</span>
`);

const ANOMALY_BLOOM = SC(`
  <span class="sc-svc sc-ok" data-body="attract" data-strength="0.2" data-feedback>API ✓</span>
  <span class="sc-svc sc-err" data-body="attract charge" data-strength="1.8" data-feedback>DB ↑↑</span>
  <span class="sc-svc sc-ok" data-body="attract" data-strength="0.15" data-feedback>CDN ✓</span>
`);

const CONFLICT_FIELD = SC(`
  <span class="sc-claim" data-body="charge" data-strength="0.9" data-feedback>Position A</span>
  <span class="sc-mid" data-body="attract" data-strength="0.2" data-feedback>Contested</span>
  <span class="sc-claim sc-warn" data-body="charge" data-strength="-0.9" data-feedback>Position B</span>
`);

const CONCEPT_CLUSTER = SC(`
  <span class="sc-tag sc-hi" data-body="cohesion" data-strength="1.1" data-feedback>Field</span>
  <span class="sc-tag" data-body="cohesion" data-strength="0.8" data-feedback>Body</span>
  <span class="sc-tag" data-body="cohesion" data-strength="0.7" data-feedback>Feedback</span>
  <span class="sc-tag sc-lo" data-body="cohesion" data-strength="0.3" data-feedback>Canvas</span>
`);

const FOCUS_ORBIT = SC(`
  <span class="sc-node sc-hi" data-body="attract gravity" data-strength="1.4" data-feedback>Focused</span>
  <span class="sc-node sc-lo" data-body="attract" data-strength="0.3" data-feedback>Nearby</span>
  <span class="sc-node sc-lo" data-body="attract" data-strength="0.2" data-feedback>Far</span>
`);

const POLARITY_FILTER = SC(`
  <span class="sc-item sc-ok" data-body="charge" data-strength="1.0" data-feedback>Match</span>
  <span class="sc-item sc-lo" data-body="charge" data-strength="0" data-feedback>Neutral</span>
  <span class="sc-item sc-err" data-body="charge" data-strength="-1.0" data-feedback>Exclude</span>
`);

const DECAY_NOTICE = SC(`
  <span class="sc-mem sc-hot" data-body="attract" data-strength="1.0" data-feedback>Fresh</span>
  <span class="sc-mem" data-body="attract" data-strength="0.4" data-feedback>Aging</span>
  <span class="sc-mem sc-cold" data-body="attract" data-strength="0.05" data-feedback>Stale</span>
`);

const THRESHOLD_BLOOM = SC(`
  <span class="sc-step sc-lo" data-body="attract" data-strength="0.3" data-feedback>20%</span>
  <span class="sc-step" data-body="attract" data-strength="0.7" data-feedback>60%</span>
  <span class="sc-step sc-hi" data-body="attract gravity" data-strength="1.5" data-feedback>Threshold!</span>
`);

const GROUP_MAGNET = SC(`
  <span class="sc-item sc-ok" data-body="cohesion" data-strength="1.0" data-feedback>Group A</span>
  <span class="sc-item sc-ok" data-body="cohesion" data-strength="0.9" data-feedback>Group A</span>
  <span class="sc-item sc-warn" data-body="cohesion" data-strength="0.5" data-feedback>Group B</span>
`);

const REVIEW_PRESSURE = SC(`
  <span class="sc-item sc-err" data-body="attract charge" data-strength="1.6" data-feedback>Needs revision</span>
  <span class="sc-item sc-ok" data-body="attract" data-strength="0.6" data-feedback>Looks good</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.2" data-feedback>No comment</span>
`);

const PROVENANCE_TRAIL = SC(`
  <span class="sc-source sc-hi" data-body="attract" data-strength="1.0" data-feedback>Original</span>
  <span class="sc-source" data-body="attract" data-strength="0.6" data-feedback>Derived</span>
  <span class="sc-source sc-lo" data-body="attract" data-strength="0.2" data-feedback>Inferred</span>
`);

// Generic fallback — 3 bodies with high/mid/low weight, used for recipes
// without a tailored scaffold. Still meaningful: visitors see the field respond
// to elements of different mass, which demonstrates reciprocity.
const GENERIC = SC(`
  <span class="sc-item sc-hi" data-body="attract" data-strength="1.2" data-feedback>High mass</span>
  <span class="sc-item" data-body="attract" data-strength="0.6" data-feedback>Medium</span>
  <span class="sc-item sc-lo" data-body="attract" data-strength="0.2" data-feedback>Low mass</span>
`);

/** Map from recipe ID to the HTML scaffold fragment injected into the preview container. */
export const RECIPE_SCAFFOLDS: Record<string, string> = {
  // First-release
  'priority-well':    PRIORITY_WELL,
  'signal-path':      SIGNAL_PATH,
  'relationship-bond': RELATIONSHIP_BOND,
  'reading-field':    READING_FIELD,
  'evidence-field':   EVIDENCE_FIELD,
  'coherence-field':  COHERENCE_FIELD,
  'memory-trace':     MEMORY_TRACE,
  'guided-flow':      GUIDED_FLOW,
  // Applied tier — common use cases
  'attention-weather':    ATTENTION_WEATHER,
  'navigation-current':   NAVIGATION_CURRENT,
  'citation-thread':      CITATION_THREAD,
  'form-stability-field': FORM_STABILITY_FIELD,
  'command-intent-field': COMMAND_INTENT_FIELD,
  'selection-wake':       SELECTION_WAKE,
  'availability-pressure': AVAILABILITY_PRESSURE,
  'dependency-tension':   DEPENDENCY_TENSION,
  'staleness-drift':      STALENESS_DRIFT,
  'trust-gradient':       TRUST_GRADIENT,
  'completion-release':   COMPLETION_RELEASE,
  'group-magnet':         GROUP_MAGNET,
  'error-pressure':       ERROR_PRESSURE,
  'handoff-stream':       HANDOFF_STREAM,
  // Systems tier
  'conflict-field':       CONFLICT_FIELD,
  'concept-cluster':      CONCEPT_CLUSTER,
  'focus-orbit':          FOCUS_ORBIT,
  'decay-notice':         DECAY_NOTICE,
  'threshold-bloom':      THRESHOLD_BLOOM,
  'polarity-filter':      POLARITY_FILTER,
  'review-pressure':      REVIEW_PRESSURE,
  'provenance-trail':     PROVENANCE_TRAIL,
  // Operational
  'presence-field':       PRESENCE_FIELD,
  'consensus-well':       CONSENSUS_WELL,
  'anomaly-bloom':        ANOMALY_BLOOM,
};

/** Returns the scaffold HTML for a recipe, or the generic 3-body fallback. */
export function scaffoldFor(id: string): string {
  return RECIPE_SCAFFOLDS[id] ?? GENERIC;
}

/** One-time injection of shared scaffold element styles + delegated toggle handler. */
export function injectScaffoldStyles(): void {
  if (document.getElementById('sc-styles')) return;
  const style = document.createElement('style');
  style.id = 'sc-styles';
  style.textContent = `
    .rc-preview { flex-wrap: wrap; gap: 0.45rem; align-items: center; justify-content: center; }

    /* ── Toggle pill ───────────────────────────────────────────────────────── */
    .sc-toggle {
      position: absolute; top: 6px; right: 6px; z-index: 10;
      display: inline-flex; align-items: center;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px; background: rgba(4,5,10,0.7);
      padding: 0; cursor: pointer; overflow: hidden;
      font-family: ui-monospace, monospace; font-size: 0.62rem; letter-spacing: 0.05em;
      transition: border-color 150ms ease;
      backdrop-filter: blur(4px);
    }
    .sc-toggle:hover { border-color: rgba(255,255,255,0.22); }
    .sc-toggle-opt {
      padding: 0.18rem 0.55rem; transition: background 150ms ease, color 150ms ease;
      color: rgba(200,212,230,0.46);
    }
    /* "Use case" tab active by default */
    .sc-toggle-opt:first-child { color: rgba(228,235,247,0.9); background: rgba(255,255,255,0.09); }
    /* In field mode, flip which tab is highlighted */
    .rc-preview.sc-field-mode .sc-toggle-opt:first-child { color: rgba(200,212,230,0.46); background: transparent; }
    .rc-preview.sc-field-mode .sc-toggle-opt:last-child  { color: rgba(228,235,247,0.9); background: rgba(255,255,255,0.09); }

    /* ── Scaffold elements ─────────────────────────────────────────────────── */
    /* position:relative + z-index:1 lifts labels above the position:absolute canvas */
    .sc-item, .sc-node, .sc-nav, .sc-step, .sc-text, .sc-field,
    .sc-mem, .sc-claim, .sc-source, .sc-svc, .sc-tag, .sc-avatar,
    .sc-cmd, .sc-mid {
      display: inline-flex; align-items: center; justify-content: center;
      position: relative; z-index: 1;
      font-family: ui-monospace, monospace; font-size: 0.72rem; line-height: 1.35;
      padding: 0.22rem 0.55rem; border-radius: 5px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(10,13,20,0.82);
      white-space: nowrap;
      transition: box-shadow 0.3s ease, border-color 0.3s ease, color 0.3s ease, opacity 0.25s ease;
      box-shadow: 0 0 calc(var(--d,0) * 14px) color-mix(in srgb, var(--rc,#4da3ff) calc(var(--d,0) * 55%), transparent);
      border-color: color-mix(in srgb, var(--rc,#4da3ff) calc(var(--d,0) * 40%), rgba(255,255,255,0.08));
      color: color-mix(in srgb, rgba(228,235,247,0.95) calc(var(--d,0) * 100%), rgba(228,235,247,0.45));
    }
    /* Field mode: use visibility:hidden (not display:none) so bodies keep their
       layout positions — the field still reads data-body at those coordinates,
       so particles visibly cluster at the invisible body locations. */
    .rc-preview.sc-field-mode .sc-item,
    .rc-preview.sc-field-mode .sc-node,
    .rc-preview.sc-field-mode .sc-nav,
    .rc-preview.sc-field-mode .sc-step,
    .rc-preview.sc-field-mode .sc-text,
    .rc-preview.sc-field-mode .sc-field,
    .rc-preview.sc-field-mode .sc-mem,
    .rc-preview.sc-field-mode .sc-claim,
    .rc-preview.sc-field-mode .sc-source,
    .rc-preview.sc-field-mode .sc-svc,
    .rc-preview.sc-field-mode .sc-tag,
    .rc-preview.sc-field-mode .sc-avatar,
    .rc-preview.sc-field-mode .sc-cmd,
    .rc-preview.sc-field-mode .sc-mid { visibility: hidden; }

    /* ── Semantic state tints ──────────────────────────────────────────────── */
    .sc-hi   { border-color: rgba(77,163,255,0.3); color: rgba(228,235,247,0.8); }
    .sc-lo   { opacity: 0.5; }
    .sc-ok   { border-color: rgba(95,208,168,0.3); color: rgba(95,208,168,0.8); }
    .sc-warn { border-color: rgba(255,206,107,0.3); color: rgba(255,206,107,0.8); }
    .sc-err  { border-color: rgba(255,110,156,0.3); color: rgba(255,110,156,0.75); }
    .sc-active { border-color: rgba(77,163,255,0.45); color: rgba(228,235,247,0.9); font-weight: 600; }
    .sc-done { opacity: 0.38; }
    .sc-hot  { color: rgba(255,174,77,0.85); border-color: rgba(255,174,77,0.3); }
    .sc-cold { color: rgba(150,165,190,0.45); }

    /* ── Element variants ──────────────────────────────────────────────────── */
    .sc-text {
      display: block; width: 100%; text-align: left; padding: 0.35rem 0.6rem;
      font-family: inherit; font-size: 0.75rem; line-height: 1.45; white-space: normal;
    }
    .sc-field { background: rgba(255,255,255,0.06); }
    .sc-avatar {
      width: 28px; height: 28px; border-radius: 50%; font-weight: 700; padding: 0;
      background: rgba(77,163,255,0.12); border-color: rgba(77,163,255,0.35);
    }
    .sc-claim  { font-weight: 600; border-color: rgba(255,206,107,0.3); color: rgba(255,206,107,0.85); }
    .sc-source { font-size: 0.68rem; padding: 0.15rem 0.45rem; }
    .sc-mid    { opacity: 0.45; padding: 0.15rem 0.3rem; }
    .sc-tag    { font-size: 0.7rem; border-radius: 999px; }
    .sc-svc    { font-size: 0.7rem; }
  `;
  document.head.appendChild(style);

  // Delegated toggle — one handler for all preview cards, present and future.
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('.sc-toggle');
    if (!btn) return;
    const preview = btn.closest<HTMLElement>('.rc-preview');
    if (!preview) return;
    const next = !preview.classList.contains('sc-field-mode');
    preview.classList.toggle('sc-field-mode', next);
    btn.setAttribute('aria-pressed', String(next));
    btn.title = next ? 'Show use case' : 'Show field visualization';
  });
}
