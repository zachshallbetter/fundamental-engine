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

export type LintCode =
  | 'relation-target-missing'
  | 'visual-orphan'
  | 'visual-not-hidden'
  | 'state-unregistered'
  | 'overlay-without-links'
  | 'feedback-non-css-var'
  | 'measurement-off-phase';

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
    ...lintStateRegistration(platform.state, platform.measure),
    ...lintOverlayLinks(platform.overlays, platform.relationships),
    ...lintFeedbackVars(platform.feedback),
    ...lintVisuals(platform.visuals),
    ...lintSchedulerViolations(platform.scheduler),
  ];
}
