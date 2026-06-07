/**
 * MeasurementRegistry — frame-stable geometry. The native primitive field-ui wishes existed: read
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

  /** Register an element for measurement (idempotent — re-registering refreshes its options). */
  register(element: Element, opts: MeasureRegistration = {}): void {
    this.entries.set(element, { element, ...opts });
  }

  unregister(element: Element): void {
    this.entries.delete(element);
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Read every registered element's geometry once and return the immutable snapshot. Disconnected
   * elements are pruned. `now`/`viewport` are injectable so this is testable without a live DOM.
   */
  measure(now = 0, viewport?: Viewport): readonly FieldMeasurement[] {
    const vp = viewport ?? defaultViewport();
    const out: FieldMeasurement[] = [];
    for (const [el, e] of this.entries) {
      if (!el.isConnected) {
        this.entries.delete(el);
        continue;
      }
      const rect = toFieldRect(e.getRect ? e.getRect() : el.getBoundingClientRect());
      const ratio = visibilityRatio(rect, vp);
      out.push({
        element: el,
        rect,
        visible: ratio > 0,
        visibilityRatio: ratio,
        coordinateSpace: e.coordinateSpace ?? 'viewport',
        timestamp: now,
      });
    }
    this.snapshot = out;
    return out;
  }

  /** The most recent snapshot (without re-reading layout). */
  last(): readonly FieldMeasurement[] {
    return this.snapshot;
  }

  /** The latest measurement for one element, if present. */
  for(element: Element): FieldMeasurement | undefined {
    return this.snapshot.find((m) => m.element === element);
  }
}

function defaultViewport(): Viewport {
  if (typeof window !== 'undefined') return { width: window.innerWidth, height: window.innerHeight };
  return { width: 0, height: 0 };
}
