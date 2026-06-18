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
  | 'feedback-lane-inert';

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

export interface LintOptions {
  /** the subtree to scan for relation targets (defaults to the platform root). */
  root?: ParentNode;
  /** id resolver for relation targets (defaults to document.getElementById). */
  resolve?: Resolver;
}

/** Run every platform lint rule over a FieldPlatform and return the aggregated warnings. */
export function lintPlatform(platform: PlatformLike, opts: LintOptions = {}): PlatformLintWarning[] {
  const root = opts.root ?? platform.root;
  const resolve: Resolver = opts.resolve ?? ((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null));
  return [
    ...lintRelationTargets(root, resolve),
    ...lintSinkFeedback(root),
    ...lintFeedbackVarReads(root),
    ...lintStateRegistration(platform.state, platform.measure),
    ...lintOverlayLinks(platform.overlays, platform.relationships),
    ...lintFeedbackVars(platform.feedback),
    ...lintInertFeedback(platform.feedback),
    ...lintVisuals(platform.visuals),
    ...lintSchedulerViolations(platform.scheduler),
  ];
}
