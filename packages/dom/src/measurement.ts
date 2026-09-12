/**
 * MeasurementRegistry — frame-stable geometry. The native primitive Fundamental wishes existed: read
 * every registered element's box once per frame and hand back an immutable snapshot, so the rest of
 * the system works from one consistent set of rectangles instead of each force calling
 * `getBoundingClientRect()` whenever it likes (which risks layout thrash).
 *
 * Strict read-phase: `measure()` only reads. Feedback (writes) happens in a separate phase. Default
 * measurement is the host box (Shadow-DOM safe); a `getRect` override feeds closed roots / inner cores.
 *
 * Opt-in observe mode (#689, `new MeasurementRegistry({ observe: true })`): instead of reading every
 * registered rect on every pass, entries are dirty-marked by a `ResizeObserver` + `IntersectionObserver`
 * (size / visibility edges), by ANY scroll (captured at the document — a scroll moves every viewport
 * rect, which no observer reports), and by a fallback full read every `fallbackEvery` passes (default
 * 30) that bounds the drift observers cannot see (ancestor layout shifts, transforms). A clean entry
 * reuses its previous rect; the snapshot, the `for()` index, the prune, and the read-phase guard all
 * behave exactly as in poll mode. Where observers are unavailable (SSR, older runtimes) observe mode
 * degrades to the default per-pass read. The default (`observe` unset) is byte-for-byte the shipped
 * registry — no observers are constructed and no listener is installed.
 */
import type { CoordinateSpace, FieldMeasurement, FieldRect, Viewport } from './types.ts';
import { bodyObserversSupported, observeBodyGeometry, type ObserverView } from './observe-bodies.ts';

export interface MeasurementRegistryOptions {
  /** opt into observer/scroll dirty-marking (#689); default `false` — every pass reads every rect. */
  observe?: boolean;
  /** observe mode: force a full re-read every N measure passes (default 30); `0` disables the fallback. */
  fallbackEvery?: number;
  /** observe mode: the window supplying the observers + the document to capture scroll on. Defaults
   *  to the global (`window`); injectable so the mode is testable without a live DOM. */
  view?: (ObserverView & { document?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> }) | null;
}

export interface MeasureRegistration {
  /** semantic role (body, relationship endpoint, container, visual…). */
  role?: string;
  coordinateSpace?: CoordinateSpace;
  /** rectangle provider when the body box is not the element box (closed roots, inner cores). */
  getRect?: () => DOMRect;
}

interface Entry extends MeasureRegistration {
  element: Element;
}

function toFieldRect(r: DOMRect | { left: number; top: number; width: number; height: number }): FieldRect {
  const left = r.left;
  const top = r.top;
  const width = r.width;
  const height = r.height;
  return {
    x: left,
    y: top,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
    top,
    right: left + width,
    bottom: top + height,
    left,
  };
}

/** Overlap fraction of a rect within the viewport box ∈ [0,1]. */
function visibilityRatio(r: FieldRect, vp: Viewport): number {
  const area = r.width * r.height;
  if (area <= 0) return 0;
  const ox = Math.max(0, Math.min(r.right, vp.width) - Math.max(r.left, 0));
  const oy = Math.max(0, Math.min(r.bottom, vp.height) - Math.max(r.top, 0));
  return Math.min(1, (ox * oy) / area);
}

export class MeasurementRegistry {
  private readonly entries = new Map<Element, Entry>();
  private snapshot: readonly FieldMeasurement[] = [];
  /**
   * Identity-keyed index into the current `snapshot`, rebuilt each `measure()`. Turns `for(element)`
   * from an O(N) linear scan of the snapshot array (which forces called per-element → O(M×N)/frame)
   * into an O(1) Map lookup. Reset before `measure()` populates it, so `for()` on a since-pruned
   * element correctly returns undefined.
   */
  private byElement = new Map<Element, FieldMeasurement>();
  /** observe mode only: the previous pass's index, swapped in so a clean entry can reuse its rect. */
  private spare = new Map<Element, FieldMeasurement>();
  private guard: ((op: string) => void) | null = null;
  // ── observe mode (#689) ──
  private readonly fallbackEvery: number;
  private readonly view: MeasurementRegistryOptions['view'];
  /** true once the observers are live — `observe: true` on a runtime with ResizeObserver. */
  private observing = false;
  private unobserve: (() => void) | null = null;
  private offScroll: (() => void) | null = null;
  private readonly dirty = new Set<Element>();
  private allDirty = true;
  private passes = 0;

  constructor(opts: MeasurementRegistryOptions = {}) {
    this.fallbackEvery = opts.fallbackEvery ?? 30;
    this.view = opts.view === undefined ? (typeof globalThis === 'undefined' ? null : (globalThis as MeasurementRegistryOptions['view'])) : opts.view;
    if (opts.observe && bodyObserversSupported(this.view)) {
      this.observing = true;
      const markAll = (): void => {
        this.allDirty = true;
      };
      // a scroll anywhere moves every viewport rect at once: capture it at the document (scroll
      // events don't bubble) and re-read everything on the next pass. Passive — read-only listener.
      const doc = this.view?.document;
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('scroll', markAll, { capture: true, passive: true });
        this.offScroll = () => doc.removeEventListener('scroll', markAll, { capture: true });
      }
    }
  }

  /** Whether observe mode is live (opted in AND the runtime has observers). */
  get observed(): boolean {
    return this.observing;
  }

  /** (#689) rebind the observers to the current entry set — one observer pair for all entries. */
  private rebindObservers(): void {
    this.unobserve?.();
    this.unobserve = null;
    if (!this.observing || this.entries.size === 0) return;
    // the observers may fire for the initial observation of a fresh element — that is a harmless
    // extra mark; a mark never triggers a read outside `measure()` (read-phase discipline holds).
    this.unobserve = observeBodyGeometry([...this.entries.keys()], (el) => {
      this.dirty.add(el);
    }, { view: this.view });
  }

  /** Release the observe-mode observers + scroll listener. Idempotent; the registry stays usable
   *  (it reverts to per-pass reads). Nothing to release in the default poll mode. */
  dispose(): void {
    this.unobserve?.();
    this.unobserve = null;
    this.offScroll?.();
    this.offScroll = null;
    this.observing = false;
    this.dirty.clear();
    this.allDirty = true;
  }

  /**
   * Install a phase guard (the FrameScheduler supplies one via `readGuard()`). It is consulted
   * before reading layout, so a measurement requested in the write phase is caught. Decoupled by
   * design: measurement never imports the scheduler. Pass `null` to remove the guard.
   */
  setPhaseGuard(guard: ((op: string) => void) | null): void {
    this.guard = guard;
  }

  /** Register an element for measurement (idempotent — re-registering refreshes its options). */
  register(element: Element, opts: MeasureRegistration = {}): void {
    const fresh = !this.entries.has(element);
    this.entries.set(element, { element, ...opts });
    if (this.observing) {
      this.dirty.add(element); // a (re)registered entry is always read on the next pass
      if (fresh) this.rebindObservers();
    }
  }

  unregister(element: Element): void {
    if (this.entries.delete(element) && this.observing) {
      this.dirty.delete(element);
      this.rebindObservers();
    }
  }

  /** Whether an element is registered for measurement (does not require a measure pass). */
  has(element: Element): boolean {
    return this.entries.has(element);
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Read every registered element's geometry once and return the immutable snapshot. Disconnected
   * elements are pruned. `now`/`viewport` are injectable so this is testable without a live DOM.
   */
  measure(now = 0, viewport?: Viewport): readonly FieldMeasurement[] {
    this.guard?.('measure'); // read-phase discipline: reading layout off-phase thrashes
    const vp = viewport ?? defaultViewport();
    const out: FieldMeasurement[] = [];
    // observe mode (#689): a pass is GATED unless everything is dirty (a scroll, the first pass) or the
    // fallback cadence lands; a gated pass keeps the previous index around so clean entries reuse
    // their rect. The default mode never enters this branch — its loop is exactly the shipped one.
    let prev: Map<Element, FieldMeasurement> | null = null;
    if (this.observing) {
      this.passes++;
      const fallback = this.fallbackEvery > 0 && this.passes % this.fallbackEvery === 0;
      if (!this.allDirty && !fallback) {
        prev = this.byElement;
        this.byElement = this.spare;
        this.spare = prev;
      }
      this.allDirty = false;
    }
    const index = this.byElement;
    index.clear();
    let pruned = false;
    for (const [el, e] of this.entries) {
      if (!el.isConnected) {
        this.entries.delete(el);
        pruned = true;
        continue;
      }
      const cached = prev !== null && !this.dirty.has(el) ? prev.get(el) : undefined;
      const rect = cached !== undefined ? cached.rect : toFieldRect(e.getRect ? e.getRect() : el.getBoundingClientRect());
      const ratio = visibilityRatio(rect, vp);
      const m: FieldMeasurement = {
        element: el,
        rect,
        visible: ratio > 0,
        visibilityRatio: ratio,
        coordinateSpace: e.coordinateSpace ?? 'viewport',
        timestamp: now,
      };
      out.push(m);
      index.set(el, m);
    }
    if (this.observing) {
      this.dirty.clear();
      if (pruned) this.rebindObservers(); // drop the pruned elements from the observers too
    }
    this.snapshot = out;
    return out;
  }

  /** The most recent snapshot (without re-reading layout). */
  last(): readonly FieldMeasurement[] {
    return this.snapshot;
  }

  /** The latest measurement for one element, if present. O(1) via the identity index. */
  for(element: Element): FieldMeasurement | undefined {
    return this.byElement.get(element);
  }
}

function defaultViewport(): Viewport {
  if (typeof window !== 'undefined') return { width: window.innerWidth, height: window.innerHeight };
  return { width: 0, height: 0 };
}
