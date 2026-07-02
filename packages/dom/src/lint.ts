/**
 * Platform lint — the guardrails that keep a field system honest. A field layer fails quietly: a
 * relation points at a missing id, a visual duplicates text screen readers already read, an element
 * is styled from state it was never registered for. These rules surface that drift as warnings.
 *
 * Each rule is a pure function over the registries (or the DOM, given a resolver), so it is testable
 * without a live page; `lintPlatform` aggregates them over a FieldPlatform. Lint reads — it never
 * mutates state, physics, or the DOM.
 */
import type { MeasurementRegistry } from './measurement.ts';
import type { StateRegistry } from './state.ts';
import type { FeedbackRegistry } from './feedback.ts';
import type { OverlayRegistry } from './overlays.ts';
import type { RelationshipRegistry } from './relationships.ts';
import type { VisualBindingRegistry } from './visual-bindings.ts';
import type { FrameScheduler } from './schedule.ts';
import type { Resolver } from './relationships.ts';
import { classifyMetric } from './metrics.ts';

export type LintCode =
  | 'relation-target-missing'
  | 'visual-orphan'
  | 'visual-not-hidden'
  | 'state-unregistered'
  | 'overlay-without-links'
  | 'feedback-non-css-var'
  | 'measurement-off-phase'
  | 'sink-without-feedback'
  | 'feedback-vars-unwritten'
  | 'feedback-writes-unread'
  | 'feedback-reads-unwritten'
  | 'feedback-never-written'
  | 'feedback-lane-inert'
  | 'compositing-fill-trap'
  | 'motion-without-reduced-motion';

export interface PlatformLintWarning {
  code: LintCode;
  severity: 'warning' | 'error';
  message: string;
  /** the element at fault, when there is one. */
  element?: Element;
}

/** A `[data-field-relation]` whose `data-field-target` does not resolve points at nothing. Pure. */
export function lintRelationTargets(root: ParentNode, resolve: Resolver): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  root.querySelectorAll('[data-field-relation]').forEach((el) => {
    const target = el.getAttribute('data-field-target');
    if (!target) {
      out.push({ code: 'relation-target-missing', severity: 'warning', element: el, message: `[data-field-relation="${el.getAttribute('data-field-relation')}"] has no data-field-target` });
      return;
    }
    const id = target.startsWith('#') ? target.slice(1) : target;
    if (!resolve(id))
      out.push({ code: 'relation-target-missing', severity: 'warning', element: el, message: `data-field-target "${target}" resolves to no element` });
  });
  return out;
}

/**
 * A sink that captures but never reports: `data-absorb`/`data-max` on a `sink` body with no
 * `data-feedback` — the engine takes matter in but never writes `--load` back, so the body fills
 * invisibly. This exact gap shipped (a vessel that captured for months while its meter sat empty),
 * which is why it lints. Pure.
 */
export function lintSinkFeedback(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  root.querySelectorAll('[data-absorb], [data-max]').forEach((el) => {
    const tokens = (el.getAttribute('data-body') ?? '').split(/\s+/).filter(Boolean);
    if (!tokens.includes('sink')) return;
    if (el.hasAttribute('data-feedback')) return;
    out.push({
      code: 'sink-without-feedback',
      severity: 'warning',
      element: el,
      message: `a sink body carries ${el.hasAttribute('data-absorb') ? 'data-absorb' : 'data-max'} but no data-feedback — the engine will capture matter but never write --load back`,
    });
  });
  return out;
}

/** The inline-style substrings that mean "this element reads an engine-written channel". */
const FEEDBACK_VAR_READS = ['var(--d', 'var(--load', 'var(--field-'] as const;

/**
 * An element whose inline style *reads* a feedback channel (`var(--d…)`, `var(--load…)`,
 * `var(--field-…)`) while its body never opted into writes (`data-body` without `data-feedback`)
 * styles itself from variables that will never be set for it. Pure.
 */
export function lintFeedbackVarReads(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  root.querySelectorAll('[data-body]').forEach((el) => {
    if (el.hasAttribute('data-feedback')) return;
    const style = el.getAttribute('style') ?? '';
    const read = FEEDBACK_VAR_READS.find((v) => style.includes(v));
    if (read)
      out.push({
        code: 'feedback-vars-unwritten',
        severity: 'warning',
        element: el,
        message: `inline style reads ${read}…) but the body carries no data-feedback — that channel is never written for it`,
      });
  });
  return out;
}

/**
 * The producer side of the feedback contract: a `data-feedback` body gets `--d`/`--load`/`--field-*`
 * written onto it every frame, but if **no** style rule reads those vars the body changes invisibly —
 * the recurring "charged but reads nothing" bug (`.btn`, `.hero-mass`). This is the inverse of
 * `lintFeedbackVarReads` (reads-without-writes). **Dev-only, heuristic, browser-coupled:** it walks the
 * document's accessible stylesheets for rules that read a feedback var (the *consumers*) and warns for
 * any `data-feedback` body that neither reads one inline nor matches such a rule. It no-ops where
 * stylesheets aren't reachable (SSR / tests / cross-origin sheets), so it can only under-report there,
 * never false-positive. Pseudo-classes/elements are stripped from consumer selectors before matching,
 * keeping the heuristic lenient (it would rather miss a warning than fire a wrong one).
 */
export function lintFeedbackWritesUnread(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  if (typeof document === 'undefined') return out;
  // collect the selectors of rules that read a feedback var — the consumer side of the contract.
  const consumerSelectors: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet → unreadable, skip
    for (const rule of Array.from(rules ?? [])) {
      const r = rule as CSSStyleRule;
      if (r.selectorText && r.cssText && FEEDBACK_VAR_READS.some((v) => r.cssText.includes(v)))
        consumerSelectors.push(r.selectorText);
    }
  }
  root.querySelectorAll('[data-body][data-feedback]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    if (FEEDBACK_VAR_READS.some((v) => style.includes(v))) return; // reads one inline — consumed
    const consumed = consumerSelectors.some((sel) =>
      sel.split(',').some((part) => {
        const clean = part.trim().replace(/::?[\w-]+(\([^)]*\))?/g, ''); // drop :hover / ::before etc.
        if (!clean) return false;
        try { return el.matches(clean); } catch { return false; }
      }),
    );
    if (!consumed)
      out.push({
        code: 'feedback-writes-unread',
        severity: 'warning',
        element: el,
        message:
          'data-feedback body is written --d/--load/--field-* every frame but no style rule reads them — it changes invisibly (style against var(--field-density), var(--d)…)',
      });
  });
  return out;
}

/**
 * The consumer side at the STYLESHEET level — the stylesheet companion to `lintFeedbackVarReads`
 * (which only sees *inline* styles) and the mirror of `lintFeedbackWritesUnread`: a CSS rule reads a
 * feedback var (`var(--field-*)`/`var(--load)`/`var(--d)`) and matches a `[data-body]` element that has
 * **no** `data-feedback` — a field body styled from a channel it never opted into, so the style sits at
 * its `var(…, fallback)` forever. Scoped to `[data-body]` (not every matched element) to stay high-signal
 * and avoid flagging intentional generic fallbacks. **Dev-only, heuristic, browser-coupled:** no-ops
 * where stylesheets are unreachable (SSR / tests / cross-origin), so it can only under-report.
 */
export function lintFeedbackReadsUnwritten(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  if (typeof document === 'undefined') return out;
  const seen = new Set<Element>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet → unreadable, skip
    for (const rule of Array.from(rules ?? [])) {
      const r = rule as CSSStyleRule;
      if (!r.selectorText || !r.cssText || !FEEDBACK_VAR_READS.some((v) => r.cssText.includes(v))) continue;
      for (const part of r.selectorText.split(',')) {
        const clean = part.trim().replace(/::?[\w-]+(\([^)]*\))?/g, ''); // drop :hover / ::before etc.
        if (!clean) continue;
        let matched: ArrayLike<Element>;
        try { matched = root.querySelectorAll(clean); } catch { continue; }
        for (const el of Array.from(matched)) {
          if (seen.has(el) || !el.hasAttribute('data-body') || el.hasAttribute('data-feedback')) continue;
          seen.add(el);
          out.push({
            code: 'feedback-reads-unwritten',
            severity: 'warning',
            element: el,
            message: `a style rule (${r.selectorText}) styles this body from a feedback var, but it has no data-feedback — that channel is never written for it, so the style stays at its fallback`,
          });
        }
      }
    }
  }
  return out;
}

/** An element styled from field state it was never registered to measure is feedback with no source. Pure. */
export function lintStateRegistration(state: StateRegistry, measure: MeasurementRegistry): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  for (const el of state.elements()) {
    if (!measure.has(el))
      out.push({ code: 'state-unregistered', severity: 'warning', element: el, message: 'element holds field state but is not registered for measurement' });
  }
  return out;
}

/** A relationship overlay with no relationships behind it draws a graph that does not exist. Pure. */
export function lintOverlayLinks(overlays: OverlayRegistry, relationships: RelationshipRegistry): PlatformLintWarning[] {
  const hasRelOverlay = overlays.all().some((o) => o.type === 'relationship');
  if (hasRelOverlay && relationships.size === 0)
    return [{ code: 'overlay-without-links', severity: 'warning', message: 'a relationship overlay exists but the RelationshipRegistry has no links' }];
  return [];
}

/**
 * A feedback binding to a metric lane the platform can never produce: `--field-<m>` where `<m>` is a
 * DESIGNED metric (not computed generically, not the supplied-only pair) AND the element declares no
 * `data-field-<m>` to ground it. The lane is bound but will never be written — the element styles
 * itself from a channel that stays at rest. This is the gap the navigation sweep hit
 * (`navigation-current` declares `signal`/`route-strength`); same class as a sink that captures but
 * never reports (`lintSinkFeedback`). Pure.
 */
export function lintInertFeedback(feedback: FeedbackRegistry): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  for (const { element, vars } of feedback.boundVars()) {
    for (const name of vars) {
      if (!name.startsWith('--field-')) continue;
      const metric = name.slice('--field-'.length);
      if (!metric || classifyMetric(metric) !== 'designed') continue;
      if (element.hasAttribute(`data-field-${metric}`)) continue; // grounded by the host — fine
      out.push({
        code: 'feedback-lane-inert',
        severity: 'warning',
        element,
        message: `feedback binds ${name} but "${metric}" is neither computed by the platform nor supplied (data-field-${metric}) on this element — the lane is never written`,
      });
    }
  }
  return out;
}

/** Default flush count after which a still-empty feedback body is considered "never written". */
export const FEEDBACK_NEVER_WRITTEN_FRAMES = 120;

/**
 * The RUNTIME half of the silent contract gap, the companion to `lintFeedbackWritesUnread` (which is
 * static/CSS-based): a `data-feedback` body that has lived through many `flush()` calls but never once
 * received a non-zero value. The CSS consumer may be wired correctly, yet the body still reacts to
 * nothing — its density (or any bound channel) stays at rest forever, usually because it was never
 * measured, sits outside the field, or no force ever reaches it. Reads `FeedbackRegistry.feedbackActivity()`
 * (accumulated in `flush()`); a body under the threshold is still warming up and is left alone, so this
 * only fires once the field has had a fair chance to write. Pure (reads the registry, never mutates).
 */
export function lintFeedbackNeverWritten(
  feedback: FeedbackRegistry,
  afterFrames: number = FEEDBACK_NEVER_WRITTEN_FRAMES,
): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  for (const { element, flushes, written } of feedback.feedbackActivity()) {
    if (written || flushes < afterFrames) continue;
    out.push({
      code: 'feedback-never-written',
      severity: 'warning',
      element,
      message: `data-feedback body has been bound for ${flushes} frames but never received a non-zero value — the reciprocal loop is inert (it is likely unmeasured, outside the field, or no force reaches it)`,
    });
  }
  return out;
}

/** Feedback must write CSS custom properties, not ARIA/attributes — state is not accessibility state. Pure. */
export function lintFeedbackVars(feedback: FeedbackRegistry): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  for (const { element, vars } of feedback.boundVars()) {
    for (const name of vars) {
      if (!name.startsWith('--'))
        out.push({ code: 'feedback-non-css-var', severity: 'error', element, message: `feedback binding writes "${name}", which is not a CSS custom property (state must not write ARIA/attributes)` });
    }
  }
  return out;
}

/** Off-phase reads recorded by the scheduler (e.g. a measurement during the write phase). */
export function lintSchedulerViolations(scheduler: FrameScheduler): PlatformLintWarning[] {
  return scheduler.violations().map((v) => ({
    code: 'measurement-off-phase' as const,
    severity: 'warning' as const,
    message: v.message,
  }));
}

/** Visual-binding warnings (orphan representations, un-hidden decorative visuals), mapped to lint. */
export function lintVisuals(visuals: VisualBindingRegistry): PlatformLintWarning[] {
  return visuals.lint().map((w) => ({
    code: (w.code === 'orphan-representation' ? 'visual-orphan' : 'visual-not-hidden') as LintCode,
    severity: w.severity,
    message: w.message,
    element: w.visual,
  }));
}

export interface PlatformLike {
  root: Element;
  measure: MeasurementRegistry;
  state: StateRegistry;
  feedback: FeedbackRegistry;
  relationships: RelationshipRegistry;
  visuals: VisualBindingRegistry;
  overlays: OverlayRegistry;
  scheduler: FrameScheduler;
}

/** A pluggable lint rule. Pure: reads only, never mutates the platform or DOM. */
export interface LintRule {
  readonly id: string;
  run(root: ParentNode, warnings: PlatformLintWarning[]): void;
}

const _customRules = new Map<string, LintRule>();

/** Register a custom lint rule globally. Returns an unregister function.
 *  The rule runs alongside built-ins on every lintPlatform() call.
 */
export function registerLintRule(rule: LintRule): () => void {
  _customRules.set(rule.id, rule);
  return () => { _customRules.delete(rule.id); };
}

export interface LintOptions {
  /** the subtree to scan for relation targets (defaults to the platform root). */
  root?: ParentNode;
  /** id resolver for relation targets (defaults to document.getElementById). */
  resolve?: Resolver;
  /** inline rules to run alongside built-ins for this call only. */
  rules?: LintRule[];
}

/**
 * The DPR2 / mix-blend fill trap (#405, #532) — the hardest-won perf lesson, made a guard. A
 * full-viewport `mix-blend-mode` canvas re-composites the WHOLE screen every frame the layer below
 * animates, **even when it's empty**. So it must stay `display:none` until it actively draws. This flags
 * a mounted full-viewport mix-blend canvas whose backing store is unsized (`0×0` → not drawing) yet
 * isn't `display:none` — paying the full-screen re-blend for nothing. Inline-style only (pure, no
 * `getComputedStyle`), matching the rest of lint.
 */
export function lintCompositingPerf(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  root.querySelectorAll('canvas').forEach((el) => {
    const c = el as HTMLCanvasElement;
    const s = c.style;
    const blend = s.mixBlendMode;
    if (!blend || blend === 'normal') return; // only mix-blend canvases pay the per-frame re-blend
    const fullViewport =
      s.position === 'fixed' &&
      (s.inset === '0' || s.inset === '0px' || (s.width === '100%' && s.height === '100%'));
    if (!fullViewport) return;
    if (s.display === 'none') return; // correctly gated out of the compositing tree — no cost
    if (c.width !== 0 && c.height !== 0) return; // has a sized backing store → assume it's actively drawing
    out.push({
      code: 'compositing-fill-trap',
      severity: 'warning',
      element: c,
      message: `a full-viewport mix-blend-mode="${blend}" canvas is mounted with an unsized backing store (0×0) but not display:none — it re-composites the whole screen every frame for nothing (#405). Set display:none until it actively draws.`,
    });
  });
  return out;
}

/**
 * Whether a declaration block expresses **independent** motion — movement the engine cannot gate under
 * reduced motion, so the author must supply a `prefers-reduced-motion` branch. Two families count:
 *
 *   1. a CSS `animation` (keyframes run on the compositor timeline, unaffected by the field), and
 *   2. a `transform`/`translate`/`rotate`/`scale`, or a `transition` on one of those (or `all`), whose
 *      value is a **static author value** — NOT derived from a field feedback var.
 *
 * The critical exemption (architectural): this engine handles reduced motion at the ENGINE level — under
 * `prefers-reduced-motion` the field freezes (dt=0), so the feedback channels (`--d`, `--field-*`,
 * `--load`) stop updating and any body whose motion is DRIVEN by reading one of them stops moving. Such a
 * body is already reduced-motion-safe and must NOT be flagged. So a motion property whose value reads a
 * feedback var is treated as engine-gated (not independent). `opacity`/`color` are not movement and never
 * count. Case-folded; operates on `cssText`/inline style text (no computed styles) to match the rest of lint.
 */
function expressesIndependentMotion(cssText: string): boolean {
  const css = cssText.toLowerCase();
  // 1. a CSS animation (name + @keyframes) runs independent of the field → always independent motion.
  if (/\banimation(-name)?\s*:/.test(css) && !/\banimation(-name)?\s*:\s*none\b/.test(css)) return true;
  // 2. a transform-family set / transitioned — but ONLY if its value is NOT a feedback var (else the
  //    engine gates it under reduced motion). We check each transform-family declaration individually so a
  //    feedback-driven transform in the same block doesn't get mis-read as static.
  for (const m of css.matchAll(/\b(transform|translate|rotate|scale)\s*:\s*([^;}]*)/g)) {
    const value = m[2] ?? '';
    if (/\bnone\b/.test(value)) continue; // transform:none is identity → no motion
    if (FEEDBACK_VAR_READS.some((v) => value.includes(v))) continue; // feedback-driven → engine-gated
    return true; // a static author transform → independent motion
  }
  // a `transition` that animates a movement property (or `all`) with a static author value is independent.
  // (A transition merely eases changes; if the changing property is itself feedback-driven, the engine
  //  freeze stills it — so a transition is only independent when paired with a static transform above,
  //  which the loop already caught. A bare `transition: transform …` with no static transform in the same
  //  block does nothing on its own, so it is not counted here.)
  return false;
}

/** Strip pseudo-classes / pseudo-elements from a selector so it can be matched against a body. */
function cleanSelector(part: string): string {
  return part.trim().replace(/::?[\w-]+(\([^)]*\))?/g, '');
}

/**
 * The accessibility sibling of the silent-contract lint (`lintFeedbackWritesUnread`): a `[data-body]`
 * that expresses **independent** motion — a CSS `@keyframes` animation, or a static (non-feedback-driven)
 * `transform`/`translate`/`rotate`/`scale` — but has **no** `@media (prefers-reduced-motion: reduce)`
 * companion rule that matches it. That is the a11y invariant this gate enforces: *reduced motion removes
 * motion, not meaning* — a body that moves on its own must offer a still form. Without the reduced-motion
 * branch, a user who asked the OS to stop animations still gets the movement.
 *
 * **Feedback-var-driven motion is deliberately exempt.** This engine gates motion at the ENGINE level:
 * under `prefers-reduced-motion` the field freezes (dt=0), so `--d`/`--field-*`/`--load` stop updating and
 * any body driven by them stops moving — it is already reduced-motion-safe and does NOT need a per-body
 * `@media` rule. Flagging those would be architecturally wrong (and would flood the site's own hundreds of
 * feedback-driven bodies). So only genuinely independent motion, which the engine cannot gate, is flagged.
 *
 * "Has a reduced-motion equivalent" is determined structurally: some rule inside a
 * `@media (prefers-reduced-motion: reduce)` block has a selector that matches the same body (after
 * pseudo-class/element stripping). The author opted the body into a reduced-motion branch; the lint
 * trusts that branch neutralizes the motion (it does not attempt to prove the branch is *correct* —
 * that is the human AT-pass half of RC-8).
 *
 * **Dev-only, heuristic, browser-coupled** — like the feedback consumer lints, it walks the document's
 * accessible stylesheets and no-ops where they are unreachable (SSR / tests / cross-origin), so it can
 * only ever under-report, never false-positive. Scoped to `[data-body]` elements only. Bodies whose
 * independent motion is expressed *inline* are also considered, and are only cleared by a matching
 * reduced-motion rule — inline styles can't carry a media query.
 */
export function lintReducedMotion(root: ParentNode): PlatformLintWarning[] {
  const out: PlatformLintWarning[] = [];
  if (typeof document === 'undefined') return out;

  // Pass 1: collect motion-bearing selectors (outside reduced-motion) and reduced-motion selectors.
  const motionSelectors: string[] = [];
  const reducedSelectors: string[] = [];
  const collect = (rules: CSSRuleList | undefined, underReduced: boolean) => {
    for (const rule of Array.from(rules ?? [])) {
      // a nested @media — recurse, flagging whether it is a reduced-motion block.
      const media = (rule as CSSMediaRule).media?.mediaText;
      if (media !== undefined) {
        const isReduced = /prefers-reduced-motion\s*:\s*reduce/.test(media);
        collect((rule as CSSMediaRule).cssRules, underReduced || isReduced);
        continue;
      }
      const r = rule as CSSStyleRule;
      if (!r.selectorText || !r.cssText) continue;
      if (underReduced) {
        reducedSelectors.push(r.selectorText);
      } else if (expressesIndependentMotion(r.cssText)) {
        motionSelectors.push(r.selectorText);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet → unreadable, skip
    collect(rules, false);
  }

  const matchesAny = (selectors: string[], el: Element): boolean =>
    selectors.some((sel) =>
      sel.split(',').some((part) => {
        const clean = cleanSelector(part);
        if (!clean) return false;
        try { return el.matches(clean); } catch { return false; }
      }),
    );

  // Pass 2: for each body, does it move INDEPENDENTLY (via CSS rule or inline) and lack a reduced-motion
  // branch? Feedback-var-driven motion is already engine-gated, so it never reaches here.
  root.querySelectorAll('[data-body]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    const movesInline = expressesIndependentMotion(style);
    const movesViaRule = matchesAny(motionSelectors, el);
    if (!movesInline && !movesViaRule) return; // static / engine-gated body → nothing to guard
    if (matchesAny(reducedSelectors, el)) return; // has a reduced-motion branch → honoured
    out.push({
      code: 'motion-without-reduced-motion',
      severity: 'warning',
      element: el,
      message:
        'a field body expresses independent motion (a CSS animation, or a static transform not driven by a field feedback var) but no @media (prefers-reduced-motion: reduce) rule matches it — reduced motion must remove motion without removing meaning; add a reduced-motion branch that stills it',
    });
  });
  return out;
}

/** Run every platform lint rule over a FieldPlatform and return the aggregated warnings. */
export function lintPlatform(platform: PlatformLike, opts: LintOptions = {}): PlatformLintWarning[] {
  const root = opts.root ?? platform.root;
  const resolve: Resolver = opts.resolve ?? ((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null));
  const warnings: PlatformLintWarning[] = [
    ...lintRelationTargets(root, resolve),
    ...lintCompositingPerf(root),
    ...lintReducedMotion(root),
    ...lintSinkFeedback(root),
    ...lintFeedbackVarReads(root),
    ...lintFeedbackWritesUnread(root),
    ...lintFeedbackReadsUnwritten(root),
    ...lintStateRegistration(platform.state, platform.measure),
    ...lintOverlayLinks(platform.overlays, platform.relationships),
    ...lintFeedbackVars(platform.feedback),
    ...lintInertFeedback(platform.feedback),
    ...lintFeedbackNeverWritten(platform.feedback),
    ...lintVisuals(platform.visuals),
    ...lintSchedulerViolations(platform.scheduler),
  ];

  // pluggable rules — inline (opts.rules) + globally registered
  const extraRules = [...(opts?.rules ?? []), ..._customRules.values()];
  for (const rule of extraRules) rule.run(root, warnings);

  return warnings;
}
