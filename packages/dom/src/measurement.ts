/**
 * MeasurementRegistry — frame-stable geometry. The native primitive Fundamental wishes existed: read
 * every registered element's box once per frame and hand back an immutable snapshot, so the rest of
 * the system works from one consistent set of rectangles instead of each force calling
 * `getBoundingClientRect()` whenever it likes (which risks layout thrash).
 *
 * Strict read-phase: `measure()` only reads. Feedback (writes) happens in a separate phase. Default
 * measurement is the host box (Shadow-DOM safe); a `getRect` override feeds closed roots / inner cores.
 */
import type { CoordinateSpace, FieldMeasurement, FieldRect, Viewport } from './types.ts';

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
  private guard: ((op: string) => void) | null = null;

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
    this.entries.set(element, { element, ...opts });
  }

  unregister(element: Element): void {
    this.entries.delete(element);
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
    const index = this.byElement;
    index.clear();
    for (const [el, e] of this.entries) {
      if (!el.isConnected) {
        this.entries.delete(el);
        continue;
      }
      const rect = toFieldRect(e.getRect ? e.getRect() : el.getBoundingClientRect());
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
