/**
 * The `--field-*` METRIC LANE — per-variable documentation, grouped by what actually writes it.
 *
 * Two different families of CSS custom property reach a body, and conflating them is the single most
 * common way the density story goes wrong:
 *
 *   · FEEDBACK CHANNELS (`--d`, `--load`, `--lit`, `--entropy`, `--coherence`, `--temperature`,
 *     `--field-density`, `--field-heatmap-density`) are written by the engine's own feedback sink
 *     every frame, on every `[data-feedback]` body, with nothing else attached. They are
 *     cross-platform capabilities — a Swift or Kotlin host receives the same record as a value. They
 *     live in `WRITEBACK` in docs-api.ts, gated by `check:docs` against
 *     `packages/core/src/engine/feedback-sink.ts`.
 *   · METRICS (this file) are the `--field-*` lane, enumerated by the engine's `FIELD_OUTPUT_VARS`.
 *
 * WHAT THIS FILE FIXES (docs-refactor Phase 6, #1001 status sweep). The retired /docs/api/declarative#feedback page
 * said the "primary seven" were "updated every frame by the core loop" and the rest "written by the
 * agent layer on interaction ticks". Read against the source, neither was true:
 *
 *   · `packages/core/src/engine/feedback-sink.ts` writes exactly ONE of these names automatically —
 *     `--field-density` (the namespaced twin of `--d`). Nothing else in the lane is written for a
 *     bare feedback body.
 *   · `--field-<metric>` otherwise comes from the pattern metric pipeline
 *     (`packages/core/src/recipes/compile.ts` → `metricVar`, bound through
 *     `packages/dom/src/feedback.ts`), so it is written only while a pattern, a `bindData` binding or
 *     `bindFieldNav` is attached to the element. `packages/dom/src/metrics.ts` is the authority on
 *     which names that pipeline can produce: COMPUTED_METRICS = attention, memory, coherence,
 *     entropy, pressure, recency, priority; SUPPLIED_ONLY = confidence, risk; anything else is a
 *     "designed" lane the host must supply or it stays inert (which `lintInertFeedback` flags).
 *   · The remaining names are RESERVED. They appear nowhere in the engine except the catalog in
 *     `packages/core/src/visual/tokens.ts`, whose own comment calls them "the agreed names for the
 *     agent layer to emit". Nothing emits them today. Documenting them as live channels sent readers
 *     to style off variables that are permanently undefined.
 *
 * Each entry therefore carries a `source`, and the reference page groups by it. `written` says when,
 * honestly, given that source.
 */
export type MetricSource =
  /** the engine's feedback sink writes it every frame, on any [data-feedback] body. */
  | 'engine'
  /** the pattern metric pipeline writes it — only while a pattern / binding is attached. */
  | 'pattern'
  /** a name the catalog reserves that nothing writes yet. */
  | 'reserved';

export interface MetricDoc {
  range: string;
  written: string;
  source: MetricSource;
  summary: string;
  use: string;
}

export const METRIC_DOCS: Record<string, MetricDoc> = {
  '--field-density': {
    range: '0–1',
    written: 'every frame, on any [data-feedback] body',
    source: 'engine',
    summary:
      'Eased fraction of nearby matter gathered at this body — the primary field-intensity signal. The canonical raw channel is `--d`; this is its longer, field-namespaced form, written in the same sink call and holding the same value. High density means the body is a convergence point.',
    use: 'Drive visual weight, font size, bloom, or z-elevation. The most reliable general-purpose readback, and the only one of this lane you get for free. Scale it first — it rests small.',
  },
  '--field-attention': {
    range: '0–1',
    written: 'every frame while a pattern or binding is attached',
    source: 'pattern',
    summary:
      'Interaction-weighted attention at this body — a composite of recency, dwell and interaction events, produced by the platform metric pipeline (a COMPUTED lane). `bindFieldNav` supplies it for navigation chrome; `applyPattern` / `bindData` supply it when a pattern declares it.',
    use: 'Distinguish hot items (read, clicked, hovered) from cold ones without a separate state tracker. Give it a `var()` fallback: a plain feedback body never receives it.',
  },
  '--field-heat': {
    range: '0–1',
    written: 'only when the host supplies data-field-heat',
    source: 'reserved',
    summary:
      '`heat` is NOT one of the metric kinds the pipeline computes (`packages/dom/src/metrics.ts`), so this is a *designed* lane: declared, but inert unless a host supplies it. The engine does measure per-particle heat — that reaches a body as the `temperature` channel (`--temperature`), which is a different variable.',
    use: 'Supply it yourself, or read `--temperature` instead. `lintInertFeedback` flags a binding to this lane that nothing writes.',
  },
  '--field-pressure': {
    range: '0–1',
    written: 'every frame while a pattern or binding is attached',
    source: 'pattern',
    summary:
      'Local contention at this body, a COMPUTED lane of the metric pipeline: how strongly competing relations pull on it. Not the same thing as the raw net force vector.',
    use: 'Surface overloaded zones in dashboards; flag items under competing forces.',
  },
  '--field-entropy': {
    range: '0–1',
    written: 'every frame while a pattern or binding is attached',
    source: 'pattern',
    summary:
      'Disorder of the local field, as the metric pipeline infers it. Distinct from `--entropy` (no `field-` prefix), which is the engine-MEASURED velocity-direction dispersion written by the feedback sink. Two different numbers; keep them apart.',
    use: 'Show field stability; trigger a warning when a layout becomes chaotic. Read `--entropy` instead if you want the engine\'s own measurement.',
  },
  '--field-coherence': {
    range: '0–1',
    written: 'every frame while a pattern or binding is attached',
    source: 'pattern',
    summary:
      'The inverse of entropy in the inferred lane — how aligned the local relations are. Distinct from `--coherence`, the engine-measured velocity alignment (and, on `:root`, from the palette colour of the same name).',
    use: 'Validate that a pattern produces stable behaviour; surface consensus vs conflict.',
  },
  '--field-memory': {
    range: '0–1',
    written: 'every frame while a pattern or binding is attached',
    source: 'pattern',
    summary:
      'Decaying trace of past attention — a long-window integral that fades when the body is ignored, and a COMPUTED lane. Distinct from `--field-attention`, which is current-weighted. `bindFieldNav` supplies it to mark visited links.',
    use: 'Show recency or staleness — "you read this", stale badges, fade-out.',
  },
  '--field-related-attention': {
    range: '0–1',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      'Attention propagated from linked bodies. A reserved name in the output catalog: the relationship graph exists, but no shipped code path emits this variable.',
    use: 'Not usable today. Compute it yourself from the relationship graph if you need it.',
  },
  '--field-path-use': {
    range: '0–1',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      'How often a body sits on a high-traffic path through the field graph. Reserved name; no shipped code path emits it.',
    use: 'Not usable today.',
  },
  '--field-attention-share': {
    range: '0–1',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      "A body's fraction of the total attention budget. Reserved name; no shipped code path emits it. The conserved-attention allocator that would feed it (`allocateAttention`) is a pure function you call yourself.",
    use: 'Not usable today — call `allocateAttention()` and write your own variable.',
  },
  '--field-attention-rank': {
    range: '0–N (integer)',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary: 'Ordinal rank of this body by attention within the field. Reserved name; nothing emits it.',
    use: 'Not usable today.',
  },
  '--field-pull-x': {
    range: '-∞–∞ (px/frame)',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      'The net horizontal force on this body. Reserved name; nothing emits it. The value is available from code — `sample(x, y)` returns the net force vector at a point.',
    use: 'Not usable in CSS today; read `sample()` from the handle instead.',
  },
  '--field-pull-y': {
    range: '-∞–∞ (px/frame)',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary: 'The net vertical force on this body. Reserved name; nothing emits it.',
    use: 'Not usable in CSS today; read `sample()` from the handle instead.',
  },
  '--field-user-wake': {
    range: '0–1',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      'A pure recency-of-touch signal: rises on interaction near the body, decays quickly. Reserved name; nothing emits it.',
    use: 'Not usable today.',
  },
  '--field-layout-shift': {
    range: '0–1',
    written: 'nothing writes it yet',
    source: 'reserved',
    summary:
      'Normalised magnitude of the most recent position displacement. Reserved name; nothing emits it. `withFlip()` performs the FLIP reflow it would describe, but writes no such variable.',
    use: 'Not usable today.',
  },
};

/** Group order + copy for the reference page. */
export const METRIC_GROUPS: { source: MetricSource; title: string; blurb: string }[] = [
  {
    source: 'engine',
    title: 'Written by the engine — automatic',
    blurb:
      'The feedback sink writes this on every [data-feedback] body, every frame, with nothing else attached. It is the only name in this lane you get for free.',
  },
  {
    source: 'pattern',
    title: 'Written by the metric pipeline — only while a pattern or binding is attached',
    blurb:
      'These are COMPUTED lanes: `applyPattern`, `bindData` and `bindFieldNav` bind them, and then they update every frame. On a body with no pattern attached they are never written, so always supply a `var()` fallback.',
  },
  {
    source: 'reserved',
    title: 'Reserved names — nothing writes them yet',
    blurb:
      'The output catalog reserves these for the agent layer, and no shipped code path emits them. They are documented so you recognise them, and so nobody styles off a variable that is permanently undefined. Treat them as a declared contract, not a live channel.',
  },
];

/** The names in one group, in catalog order. */
export const metricsOf = (source: MetricSource, all: readonly string[]): string[] =>
  all.filter((v) => METRIC_DOCS[v]?.source === source);
