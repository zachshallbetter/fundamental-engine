/**
 * createFieldPlatform — the coordinator that binds the platform registries into one object and the
 * read → state → write loop. The native participation surface field-ui wishes the browser exposed.
 *
 * Loop discipline: measurements (read) → state updates → feedback (write). Relationships, visual
 * bindings, and overlays join in the next layer (PR-B); the shape is additive.
 */
import { MeasurementRegistry } from './measurement.ts';
import { StateRegistry } from './state.ts';
import { FeedbackRegistry } from './feedback.ts';
import { RelationshipRegistry } from './relationships.ts';
import { VisualBindingRegistry } from './visual-bindings.ts';
import { OverlayRegistry } from './overlays.ts';
import type { Viewport } from './types.ts';

export interface FieldPlatform {
  /** the platform root (a `<field-root>`, an article, or the document element). */
  root: Element;
  measure: MeasurementRegistry;
  state: StateRegistry;
  feedback: FeedbackRegistry;
  relationships: RelationshipRegistry;
  visuals: VisualBindingRegistry;
  overlays: OverlayRegistry;
  /** run one read→write cycle: snapshot geometry, then flush feedback. */
  tick(now?: number, viewport?: Viewport): void;
}

export function createFieldPlatform(root: Element): FieldPlatform {
  const measure = new MeasurementRegistry();
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  const relationships = new RelationshipRegistry();
  const visuals = new VisualBindingRegistry();
  const overlays = new OverlayRegistry();
  return {
    root,
    measure,
    state,
    feedback,
    relationships,
    visuals,
    overlays,
    tick(now = 0, viewport?: Viewport): void {
      measure.measure(now, viewport); // read-phase (relationships discovered out of band)
      feedback.flush(state, now); // write-phase
      // overlays render from the fresh measurement snapshot; they read, never mutate.
    },
  };
}
