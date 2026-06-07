/**
 * FeedbackRegistry — the write-phase. Turns held state into DOM: CSS custom properties (continuous)
 * and thresholded, debounced events (discrete). The native primitive field-ui wishes existed —
 * standard feedback channels with hysteresis instead of per-frame DOM events.
 *
 * Writes happen only in `flush()`, after measurement + simulation reads. During the migration window
 * every `--field-*` is mirrored to `--forces-*`, and every `field:*` event to its `forces:*` twin.
 */
import { Thresholder } from 'field-ui';
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

function writeVar(element: Element, name: string, value: string): void {
  const style = (element as HTMLElement).style;
  if (!style || typeof style.setProperty !== 'function') return;
  style.setProperty(name, value);
  if (name.startsWith('--field-')) style.setProperty('--forces-' + name.slice('--field-'.length), value);
}

function fire(element: Element, type: string, detail: unknown): void {
  if (typeof element.dispatchEvent !== 'function') return;
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  if (type.startsWith('field:'))
    element.dispatchEvent(new CustomEvent('forces:' + type.slice('field:'.length), { bubbles: true, composed: true, detail }));
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

  /** Declare which state keys map to which CSS vars on an element (e.g. `{ density: '--field-density' }`). */
  bind(element: Element, map: VarBinding): void {
    this.bindings.set(element, { ...this.bindings.get(element), ...map });
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
   * Write-phase: apply bound state → CSS vars, apply queued direct writes, and run thresholders →
   * fire edge events. `state` supplies the numeric values for bound vars + thresholds.
   */
  flush(state: StateRegistry, now = 0): void {
    for (const [el, map] of this.bindings) {
      for (const key of Object.keys(map)) {
        const v = state.get(el, key);
        if (!v) continue;
        writeVar(el, map[key]!, v.type === 'number' ? v.value.toFixed(3) : String((v as { value?: unknown }).value ?? ''));
      }
    }
    for (const [el, vars] of this.direct) {
      for (const name of Object.keys(vars)) writeVar(el, name, vars[name]!);
    }
    this.direct.clear();
    for (const t of this.thresholds) {
      const value = state.number(t.element, t.metric);
      const edge = t.thresholder.update(value, now);
      if (edge === 'entered') fire(t.element, t.eventName, { metric: t.metric, value });
      else if (edge === 'exited' && t.exitEvent) fire(t.element, t.exitEvent, { metric: t.metric, value });
    }
  }
}
