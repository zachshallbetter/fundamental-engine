/**
 * FeedbackRegistry — the write-phase. Turns held state into DOM: CSS custom properties (continuous)
 * and thresholded, debounced events (discrete). The native primitive field-ui wishes existed —
 * standard feedback channels with hysteresis instead of per-frame DOM events.
 *
 * Writes happen only in `flush()`, after measurement + simulation reads.
 */
import { Thresholder } from '@fundamental-engine/core';
import type { StateRegistry } from './state.ts';

/** Map of state-key → CSS-var name written for an element. */
type VarBinding = Record<string, string>;

interface ThresholdEntry {
  element: Element;
  eventName: string;
  metric: string;
  exitEvent?: string;
  thresholder: Thresholder;
}

/** Write a CSS custom property. Returns the count of actual DOM mutations. */
function writeVar(element: Element, name: string, value: string): number {
  const style = (element as HTMLElement).style;
  if (!style || typeof style.setProperty !== 'function') return 0;
  style.setProperty(name, value);
  return 1;
}

function removeVar(element: Element, name: string): void {
  const style = (element as HTMLElement).style;
  if (!style || typeof style.removeProperty !== 'function') return;
  style.removeProperty(name);
}

function fire(element: Element, type: string, detail: unknown): void {
  if (typeof element.dispatchEvent !== 'function') return;
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export interface ThresholdOptions {
  /** the state key whose value crosses the threshold. */
  metric: string;
  enter: number;
  exit: number;
  debounce?: number;
  /** event dispatched on the exit edge (e.g. `field:dim` to pair with `field:lit`). */
  exitEvent?: string;
}

export class FeedbackRegistry {
  private readonly bindings = new Map<Element, VarBinding>();
  private readonly direct = new Map<Element, Record<string, string>>();
  private readonly thresholds: ThresholdEntry[] = [];
  private _cssWritesLastFrame = 0;

  /** Declare which state keys map to which CSS vars on an element (e.g. `{ density: '--field-density' }`). */
  bind(element: Element, map: VarBinding): void {
    this.bindings.set(element, { ...this.bindings.get(element), ...map });
  }

  /**
   * Remove the CSS var bound to `key` on `element` from the DOM. Use
   * when a metric becomes absent — e.g. the host stops supplying `data-field-confidence` — so a value
   * written on an earlier `flush()` doesn't linger. A no-op when nothing is bound for `key`; the
   * binding itself is left intact, so the var is rewritten if the metric returns. `flush()` already
   * skips keys with no state, so this only clears the previously written inline value.
   */
  clearVar(element: Element, key: string): void {
    const name = this.bindings.get(element)?.[key];
    if (name) removeVar(element, name);
  }

  /** The declared bindings (element → the CSS-var names it writes), for lint / inspection. */
  boundVars(): Array<{ element: Element; vars: string[] }> {
    return [...this.bindings].map(([element, map]) => ({ element, vars: Object.values(map) }));
  }

  /**
   * Actual `style.setProperty` calls made during the last `flush()`. Use this (not
   * `boundVars().length`) to measure real per-frame DOM write cost: off-screen elements with
   * active bindings still generate mutations even though they produce no visible change.
   */
  cssWritesLastFrame(): number {
    return this._cssWritesLastFrame;
  }

  /** Queue a direct CSS-var write (applied on the next `flush`). */
  set(element: Element, vars: Record<string, number | string>): void {
    const cur = this.direct.get(element) ?? {};
    for (const k of Object.keys(vars)) cur[k] = String(vars[k]);
    this.direct.set(element, cur);
  }

  /** Register a thresholded, debounced event for an element metric (hysteresis via enter/exit). */
  threshold(element: Element, eventName: string, opts: ThresholdOptions): void {
    this.thresholds.push({
      element,
      eventName,
      metric: opts.metric,
      exitEvent: opts.exitEvent,
      thresholder: new Thresholder({ enter: opts.enter, exit: opts.exit, debounceMs: opts.debounce ?? 0 }),
    });
  }

  /**
   * Drop ALL bindings and thresholds registered for one element. Use when an element is removed from
   * the DOM and you want immediate reclamation rather than waiting for the next flush() sweep.
   */
  unregister(element: Element): void {
    this.bindings.delete(element);
    this.direct.delete(element);
    // splice in reverse so the index arithmetic stays correct as we remove entries
    for (let i = this.thresholds.length - 1; i >= 0; i--) {
      if (this.thresholds[i]!.element === element) this.thresholds.splice(i, 1);
    }
  }

  /**
   * Write-phase: apply bound state → CSS vars, apply queued direct writes, and run thresholders →
   * fire edge events. `state` supplies the numeric values for bound vars + thresholds. Disconnected
   * elements are pruned here — the natural per-frame moment — so bindings and thresholds for removed
   * elements never accumulate across the lifetime of the registry.
   */
  flush(state: StateRegistry, now = 0): void {
    this._cssWritesLastFrame = 0;
    for (const [el, map] of this.bindings) {
      // prune entries whose element left the DOM; writing to a disconnected element is a no-op
      // layout-wise but still costs a Map lookup + style.setProperty call every frame.
      if (!el.isConnected) { this.bindings.delete(el); continue; }
      for (const key of Object.keys(map)) {
        const v = state.get(el, key);
        if (!v) continue;
        this._cssWritesLastFrame += writeVar(el, map[key]!, v.type === 'number' ? v.value.toFixed(3) : String((v as { value?: unknown }).value ?? ''));
      }
    }
    for (const [el, vars] of this.direct) {
      for (const name of Object.keys(vars)) this._cssWritesLastFrame += writeVar(el, name, vars[name]!);
    }
    this.direct.clear();
    // prune disconnected threshold entries in-place (reverse splice keeps indices stable)
    for (let i = this.thresholds.length - 1; i >= 0; i--) {
      if (!this.thresholds[i]!.element.isConnected) { this.thresholds.splice(i, 1); continue; }
      const t = this.thresholds[i]!;
      const value = state.number(t.element, t.metric);
      const edge = t.thresholder.update(value, now);
      if (edge === 'entered') fire(t.element, t.eventName, { metric: t.metric, value });
      else if (edge === 'exited' && t.exitEvent) fire(t.element, t.exitEvent, { metric: t.metric, value });
    }
  }
}
