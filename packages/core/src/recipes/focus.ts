import type { FieldPattern } from './schema.ts';

/**
 * FOCUS_WELL (experimental) — the authored "focus" unit for the focus/attention substrate. A single
 * `attract` well that gathers the field toward whatever the operator or an agent is currently focused
 * on. The host writes attention with `field.focus(id, { source })`; each focused entity's `attract`
 * deepens (up to ~2×, clamped) as its `metrics.salience` freshens and relaxes as it goes stale
 * (temporal.freshness) — so the field visibly gathers toward whatever is currently focused, and any
 * unfocused body keeps its baseline pull.
 *
 * Signals-first: runs under `render: 'none'` feeding `focusState()` with zero pixels drawn; the
 * `heatmap` layer is the opt-in visual (source-tinted operator-vs-agent heat is a later render slice).
 *
 * EXPERIMENTAL — NOT part of the locked 64-Pattern `FIELD_PATTERNS` catalog.
 */
export const FOCUS_WELL: FieldPattern = {
  id: 'focus-well',
  name: 'Focus Well',
  intent:
    'Gather the field toward whatever the operator or an agent is currently focused on, and let it relax as that attention goes stale.',
  naturalField: 'gravity',
  status: 'experimental',
  primitives: ['attract'],
  concepts: ['focus', 'staleness'],
  conditions: ['focused', 'dwell', 'threshold'],
  bodies: [{ body: 'attract', strength: 1.0, range: 320, feedback: true }],
  render: ['heatmap'],
  metrics: ['salience'],
  diagnostics: ['inspector'],
  accessibility: {
    reducedMotion:
      'The top-salience entity takes a static in-focus marker (aria-current) and keeps its focusState rank; nothing travels or converges.',
    meaningWithoutMotion:
      'Focus reads as an explicit ranked, source-labelled list — the focusState() sharp-tip digest. The meaning IS the list; nothing depends on the animated well.',
  },
};

/** The focus / attention experimental pattern(s) — surfaced outside the canonical 64. */
export const FOCUS_PATTERNS: readonly FieldPattern[] = [FOCUS_WELL];
