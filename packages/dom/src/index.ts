/**
 * @fundamental-engine/dom — the platform-adjacent layer: native-first registries that let the field
 * engine treat the DOM as a connected, measurable, semantic environment. Strict dependency
 * direction: this package depends on `Fundamental` (core) for contracts; core never depends on it.
 *
 * Registries: MeasurementRegistry · StateRegistry · FeedbackRegistry · RelationshipRegistry ·
 * VisualBindingRegistry · OverlayRegistry, bound by createFieldPlatform.
 *
 * Also the browser environment adapter for the renderer-agnostic core engine: `browserHost()` (the
 * default FieldHost), `createBrowserField()` (createField + browserHost), and the DOM download
 * helpers — so core can import zero DOM.
 */
import { createField, type FieldHandle, type FieldOptions } from '@fundamental-engine/core';
import { browserHost } from './browser-host.ts';

export * from './types.ts';
export * from './env.ts';
export * from './schedule.ts';
export * from './measurement.ts';
export * from './state.ts';
export * from './feedback.ts';
export * from './relationships.ts';
export * from './visual-bindings.ts';
export * from './overlays.ts';
export * from './lint.ts';
export * from './platform.ts';
export * from './metrics.ts';
export * from './apply-recipe.ts';
export * from './field-nav.ts';
export * from './bind-data.ts';
export * from './browser-host.ts';
export * from './container-host.ts';
export * from './export-dom.ts';
export * from './governor.ts';
export * from './flip.ts';
export * from './text-bodies.ts';
export * from './contours.ts';
export * from './thread-overlay.ts';
export * from './perf.ts';
export * from './x-ray.ts';

/** Start the core engine on a canvas with the default browser host — `createField` + `browserHost()`. */
export function createBrowserField(canvas: HTMLCanvasElement, opts: Omit<FieldOptions, 'host'> = {}): FieldHandle {
  return createField(canvas, { ...opts, host: browserHost() });
}
