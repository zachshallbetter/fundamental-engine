/**
 * OverlayRegistry — visual relationship lines, field lines, callouts, and debug layers, without
 * corrupting semantic DOM. Overlays are *render layers*: they read from the relationship + measurement
 * registries and produce geometry to draw. They do not own relationships and never mutate physics.
 */
import type { MeasurementRegistry } from './measurement.ts';
import type { CoordinateSpace } from './types.ts';

export type OverlayType = 'relationship' | 'field-line' | 'debug' | 'callout' | 'attention' | 'heatmap';
export type RenderTarget = 'css' | 'svg' | 'canvas' | 'dom';

export interface FieldOverlay {
  id: string;
  type: OverlayType;
  /** the elements this overlay connects/annotates (e.g. [from, to] for a relationship line). */
  sourceElements: Element[];
  coordinateSpace: CoordinateSpace;
  renderTarget: RenderTarget;
  interactive: boolean;
}

/** A resolved segment to draw, in the overlay's coordinate space. */
export interface OverlaySegment {
  overlay: FieldOverlay;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export class OverlayRegistry {
  private readonly overlays = new Map<string, FieldOverlay>();
  private seq = 0;

  /** Register an overlay (a render record — owns no relationship, mutates no physics). */
  add(o: Omit<FieldOverlay, 'id' | 'coordinateSpace' | 'renderTarget' | 'interactive'> & Partial<FieldOverlay>): FieldOverlay {
    const full: FieldOverlay = {
      coordinateSpace: 'field-root',
      renderTarget: 'svg',
      interactive: false,
      ...o,
      id: o.id ?? `overlay-${this.seq++}`,
    };
    this.overlays.set(full.id, full);
    return full;
  }

  remove(id: string): void {
    this.overlays.delete(id);
  }

  /** Drop overlays referencing a detached source element — they can never resolve again, and their
   *  strong Element refs would otherwise pin removed subtrees alive. Run on a cadence by a frame loop. */
  prune(): void {
    for (const [id, o] of this.overlays)
      if (o.sourceElements.some((el) => el.isConnected === false)) this.overlays.delete(id);
  }

  all(): FieldOverlay[] {
    return [...this.overlays.values()];
  }

  /**
   * Resolve connection overlays (relationship/callout) into segments between the centres of their
   * two source elements, using a measurement snapshot. Overlays whose endpoints aren't measured are
   * skipped. Pure given the measurement registry — no drawing here.
   */
  resolveSegments(measure: MeasurementRegistry): OverlaySegment[] {
    const segs: OverlaySegment[] = [];
    for (const o of this.overlays.values()) {
      if (o.sourceElements.length < 2) continue;
      const a = measure.for(o.sourceElements[0]!);
      const b = measure.for(o.sourceElements[1]!);
      if (!a || !b) continue;
      segs.push({ overlay: o, from: { x: a.rect.cx, y: a.rect.cy }, to: { x: b.rect.cx, y: b.rect.cy } });
    }
    return segs;
  }
}
