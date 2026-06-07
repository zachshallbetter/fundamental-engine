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
import type { Viewport } from './types.ts';

export interface FieldPlatform {
  /** the platform root (a `<field-root>`, an article, or the document element). */
  root: Element;
  measure: MeasurementRegistry;
  state: StateRegistry;
  feedback: FeedbackRegistry;
  /** run one read→write cycle: snapshot geometry, then flush feedback. */
  tick(now?: number, viewport?: Viewport): void;
}

export function createFieldPlatform(root: Element): FieldPlatform {
  const measure = new MeasurementRegistry();
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  return {
    root,
    measure,
    state,
    feedback,
    tick(now = 0, viewport?: Viewport): void {
      measure.measure(now, viewport); // read-phase
      feedback.flush(state, now); // write-phase
    },
  };
}
