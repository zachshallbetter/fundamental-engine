/**
 * Event agents (§22.5) — a force/condition firing on a body dispatches a
 * debounced CustomEvent, so the field can drive app behaviour, not just pixels.
 * Declared with `data-on="dense:field:lit, captured:field:dock"` (trigger:event,
 * comma-separated). Rising-edge debounced: fires once on cross, re-arms on reset.
 */

import type { Body } from './types.ts';

// ── host-agnostic discrete event bus (the read side, occurrences not state) ──────────────────
// Plain-data push delivery a non-DOM host (3D/native/headless) can subscribe to with
// `FieldHandle.on(type, cb)` — react to occurrences instead of polling the continuous feedback
// channels every frame. Distinct from the `data-on` CustomEvent bindings above (DOM-only).

/** The discrete occurrences the field emits, keyed by type → payload. */
export interface FieldEventMap {
  /** a `sink` body captured matter — fired on the rising edge of accreting. */
  absorb: { body: Body; count: number };
  /** a `sink` body released what it held — fired on the falling edge / supernova. */
  release: { body: Body; count: number };
  /** another body crossed INTO this body's `range` (#441) — the gameplay "entered radius" trigger. */
  enter: { body: Body; other: Body };
  /** another body crossed OUT of this body's `range` (#441). */
  exit: { body: Body; other: Body };
  /** two bodies came into contact — their boxes touched/overlapped (#441), once on the rising edge. */
  met: { a: Body; b: Body };
}
export type FieldEventType = keyof FieldEventMap;

/**
 * Per-frame coalescing buffer for the discrete event bus (#684, shadow-dom §31). A force/condition can
 * cross the same edge more than once within a single frame (multiple detection passes, a same-frame
 * fill+release); without batching the bus would deliver duplicates per tick. `record` buffers an
 * occurrence keyed by (type, source identity); `flush` delivers at most ONE event per (source, type)
 * for the frame — last write wins, so a consumer sees the final payload for that frame. State events
 * (absorb/release) key on the single source body; relational events (enter/exit/met) key on the body
 * *pair* so distinct counterparties in one frame stay distinct while a genuine duplicate collapses.
 * Identity uses object reference (the body, falling back from its element), via a per-source numeric id.
 */
export class FieldEventCoalescer {
  private readonly pending = new Map<FieldEventType, Map<string, FieldEventMap[FieldEventType]>>();
  private readonly ids = new WeakMap<object, number>();
  private seq = 0;

  private idOf(o: object): number {
    let id = this.ids.get(o);
    if (id === undefined) this.ids.set(o, (id = ++this.seq));
    return id;
  }

  /** Coalescing key for an occurrence — "per (element, type)" for state events, per-pair for relational. */
  keyOf<K extends FieldEventType>(type: K, payload: FieldEventMap[K]): string {
    if (type === 'met') {
      const p = payload as FieldEventMap['met'];
      const [x, y] = [this.idOf((p.a.el as object) ?? p.a), this.idOf((p.b.el as object) ?? p.b)].sort((m, n) => m - n);
      return `${x}:${y}`; // unordered pair
    }
    if (type === 'enter' || type === 'exit') {
      const p = payload as FieldEventMap['enter'];
      return `${this.idOf((p.body.el as object) ?? p.body)}:${this.idOf((p.other.el as object) ?? p.other)}`; // directed
    }
    const p = payload as { body: { el?: object } };
    return String(this.idOf((p.body.el as object) ?? p.body)); // single source: per (element, type)
  }

  /** Buffer an occurrence for this frame. Repeated calls for the same (type, source) keep the last payload. */
  record<K extends FieldEventType>(type: K, payload: FieldEventMap[K]): void {
    let perType = this.pending.get(type);
    if (!perType) this.pending.set(type, (perType = new Map()));
    perType.set(this.keyOf(type, payload), payload); // last-wins within the frame
  }

  /** Deliver the frame's coalesced occurrences — one per (source, type) — then clear the buffer. */
  flush(deliver: <K extends FieldEventType>(type: K, payload: FieldEventMap[K]) => void): void {
    if (this.pending.size === 0) return;
    for (const [type, perKey] of this.pending) {
      for (const payload of perKey.values()) deliver(type, payload as FieldEventMap[typeof type]);
    }
    this.pending.clear();
  }
}

export interface EventBinding {
  trigger: string;
  event: string;
  /** true while the trigger is held (so we fire only on the rising edge). */
  armed: boolean;
}

/** Parse a `data-on` string into trigger→event bindings (event names may contain ':'). */
export function parseEventBindings(spec: string): EventBinding[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return { trigger: pair.slice(0, i).trim(), event: pair.slice(i + 1).trim(), armed: false };
    })
    .filter((b) => b.trigger && b.event);
}

/** Body state a trigger reads. */
export interface TriggerState {
  d: number;
  on: boolean;
  accreted: number;
}

/** Whether a trigger currently holds (rising-edge debounce handled by the caller). */
export function triggerActive(trigger: string, s: TriggerState): boolean {
  switch (trigger) {
    case 'dense':
      return s.d > 0.6;
    case 'sparse':
      return s.d < 0.2;
    case 'engaged':
      return s.on;
    case 'captured':
      return s.accreted > 0;
    default:
      return false;
  }
}
