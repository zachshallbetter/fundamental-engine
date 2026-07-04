/**
 * The engine's INTERNAL default feedback sink (#228, Phase 5) — the fallback write path when no
 * platform `feedbackSink` is configured (raw `createField`, @fundamental-engine/vanilla, applyRecipe-scoped
 * engines). Its output is byte-identical to the direct `style.setProperty` writes the engine
 * performed historically: same variable names, same `.toFixed(3)` formatting, same write order,
 * same `field:lit`/`field:dim` hysteresis on `data-fx-lit`. Only the shape moved — every feedback
 * write now flows through the ONE sink contract, so instrumentation, lint, and future throttling
 * see every write regardless of which sink is installed.
 *
 * `defaultFeedbackSink` is engine-internal plumbing (the default at `createField`); the same write
 * path is exported publicly as {@link cssFeedbackSink} below — the named "CSS adapter" so a host can
 * install it explicitly and a non-DOM host can clearly opt out. The platform route
 * (`makeFeedbackSink` in @fundamental-engine/elements) replaces the sink when the platform runtime is
 * on; all three honor the same plain-data {@link FeedbackChannels} contract.
 *
 * DOM boundary note: this writes via the same `el.style` / `dispatchEvent` element members the
 * engine has always used on injected nodes — it touches no DOM *globals*, so the empty-allowlist
 * guard (`dom-boundary.test.ts`) holds.
 */
import type { FeedbackSink } from './types.ts';

/**
 * Write a body's feedback channels straight onto the element — the legacy direct-write behavior,
 * preserved exactly:
 *
 * - density → `--d` (the established var) + `--field-density` — same value, three decimals.
 * - heatmapDensity → `--field-heatmap-density`.
 * - load → `--load` (the canonical author-facing var).
 * - lit → `--lit`, plus the thresholded `field:lit` (rising past 0.5) / `field:dim` (falling past
 *   0.4) events, armed via `data-fx-lit` for hysteresis.
 *
 * Stateless: the lit hysteresis lives on the element (`dataset.fxLit`), exactly as before.
 */
export const defaultFeedbackSink: FeedbackSink = (el, ch) => {
  if (ch.density !== undefined) {
    const dStr = ch.density.toFixed(3);
    el.style.setProperty('--d', dStr);
    el.style.setProperty('--field-density', dStr);
  }
  if (ch.heatmapDensity !== undefined) {
    const hStr = ch.heatmapDensity.toFixed(3);
    el.style.setProperty('--field-heatmap-density', hStr);
  }
  if (ch.load !== undefined) {
    const loadStr = ch.load.toFixed(3);
    el.style.setProperty('--load', loadStr);
  }
  // measured thermodynamics (workover v0.3): the bare names per the workover/BACKLOG contract.
  // Engine-MEASURED local thermodynamics — distinct from the platform's INFERRED interaction
  // lanes (`--field-entropy` / `--field-coherence`, system-contracts §6), and numeric where the
  // `--coherence` on `:root` from cssTokens() is a palette *color* (element-scoped, so this
  // shadows that color only on data-feedback subtrees that read it — none in the tree today).
  if (ch.entropy !== undefined) el.style.setProperty('--entropy', ch.entropy.toFixed(3));
  if (ch.coherence !== undefined) el.style.setProperty('--coherence', ch.coherence.toFixed(3));
  if (ch.temperature !== undefined) el.style.setProperty('--temperature', ch.temperature.toFixed(3));
  if (ch.lit !== undefined) {
    const lit = ch.lit;
    el.style.setProperty('--lit', lit.toFixed(3));
    const armed = el.dataset.fxLit === '1';
    if (lit > 0.5 && !armed) {
      el.dataset.fxLit = '1';
      el.dispatchEvent(new CustomEvent('field:lit', { detail: { value: lit } }));
    } else if (lit < 0.4 && armed) {
      el.dataset.fxLit = '0';
      el.dispatchEvent(new CustomEvent('field:dim', { detail: { value: lit } }));
    }
  }
};

/**
 * The CSS-variable feedback **adapter** — the public name for the DOM write path above. Feedback is
 * plain data first: the engine emits a {@link FeedbackChannels} record per body, and a sink decides
 * what to do with it. This adapter is *one* choice — write the channels to the element's CSS custom
 * properties (`--d`, `--field-density`, `--load`, `--lit`, …) so an author's stylesheet reacts with
 * no JS. The DOM door (`createField` / `@fundamental-engine/vanilla` / `<field-root>`) installs it by
 * default; a non-DOM host (e.g. `@fundamental-engine/three`'s `FieldLayer`) passes its own
 * `feedbackSink` and never goes near CSS. Pass `createField({ feedbackSink: cssFeedbackSink })`
 * explicitly when you want the CSS behavior on a hand-wired host.
 */
export const cssFeedbackSink: FeedbackSink = defaultFeedbackSink;
