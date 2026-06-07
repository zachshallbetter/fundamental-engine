/**
 * StateRegistry — typed, observable element state that is NOT accessibility state. The native
 * primitive field-ui wishes existed: a place to hold numeric/boolean/vector2 channels (density,
 * attention, lit, pull) per element, separate from ARIA, that CSS and JS can both consume. This
 * registry only *holds* state; the FeedbackRegistry writes it to the DOM (read-phase vs write-phase).
 */
import type { FieldStateValue } from './types.ts';

type Raw = number | boolean | string | { x: number; y: number };

function normalize(v: Raw): FieldStateValue {
  if (typeof v === 'number') return { type: 'number', value: v };
  if (typeof v === 'boolean') return { type: 'boolean', value: v };
  if (typeof v === 'string') return { type: 'string', value: v };
  return { type: 'vector2', x: v.x, y: v.y };
}

export type StateListener = (value: FieldStateValue, key: string, element: Element) => void;

export class StateRegistry {
  private readonly store = new Map<Element, Map<string, FieldStateValue>>();
  private readonly listeners = new Map<Element, Map<string, Set<StateListener>>>();

  /** Set a typed state value on an element, notifying observers if it changed. */
  set(element: Element, key: string, value: Raw): void {
    let m = this.store.get(element);
    if (!m) {
      m = new Map();
      this.store.set(element, m);
    }
    const next = normalize(value);
    const prev = m.get(key);
    m.set(key, next);
    if (!prev || !sameValue(prev, next)) this.notify(element, key, next);
  }

  /** A numeric convenience reader (0 for absent / non-numeric). */
  number(element: Element, key: string): number {
    const v = this.store.get(element)?.get(key);
    return v && v.type === 'number' ? v.value : 0;
  }

  get(element: Element, key: string): FieldStateValue | undefined {
    return this.store.get(element)?.get(key);
  }

  has(element: Element, key: string): boolean {
    return this.store.get(element)?.has(key) ?? false;
  }

  /** All state on an element (empty map if none). */
  values(element: Element): ReadonlyMap<string, FieldStateValue> {
    return this.store.get(element) ?? new Map();
  }

  delete(element: Element, key: string): void {
    this.store.get(element)?.delete(key);
  }

  clear(element: Element): void {
    this.store.delete(element);
    this.listeners.delete(element);
  }

  /** Observe one key on one element. Returns an unsubscribe function. */
  observe(element: Element, key: string, fn: StateListener): () => void {
    let byKey = this.listeners.get(element);
    if (!byKey) {
      byKey = new Map();
      this.listeners.set(element, byKey);
    }
    let set = byKey.get(key);
    if (!set) {
      set = new Set();
      byKey.set(key, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  private notify(element: Element, key: string, value: FieldStateValue): void {
    const fns = this.listeners.get(element)?.get(key);
    if (fns) for (const fn of fns) fn(value, key, element);
  }
}

function sameValue(a: FieldStateValue, b: FieldStateValue): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'vector2' && b.type === 'vector2') return a.x === b.x && a.y === b.y;
  if (a.type === 'number' && b.type === 'number') return a.value === b.value;
  if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
  if (a.type === 'string' && b.type === 'string') return a.value === b.value;
  return false;
}
