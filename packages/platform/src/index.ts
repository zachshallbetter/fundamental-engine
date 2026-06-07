/**
 * @field-ui/platform — the platform-adjacent layer: native-first registries that let the field
 * engine treat the DOM as a connected, measurable, semantic environment. Strict dependency
 * direction: this package depends on `field-ui` (core) for contracts; core never depends on it.
 *
 * Registries: MeasurementRegistry · StateRegistry · FeedbackRegistry · RelationshipRegistry ·
 * VisualBindingRegistry · OverlayRegistry, bound by createFieldPlatform.
 */
export * from './types.ts';
export * from './schedule.ts';
export * from './measurement.ts';
export * from './state.ts';
export * from './feedback.ts';
export * from './relationships.ts';
export * from './visual-bindings.ts';
export * from './overlays.ts';
export * from './lint.ts';
export * from './platform.ts';
