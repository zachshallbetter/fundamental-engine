/**
 * @field-ui/platform — the platform-adjacent layer: native-first registries that let the field
 * engine treat the DOM as a connected, measurable, semantic environment. Strict dependency
 * direction: this package depends on `field-ui` (core) for contracts; core never depends on it.
 *
 * Foundation (PR-A): MeasurementRegistry · StateRegistry · FeedbackRegistry · createFieldPlatform.
 * (RelationshipRegistry · VisualBindingRegistry · OverlayRegistry follow in PR-B.)
 */
export * from './types.ts';
export * from './measurement.ts';
export * from './state.ts';
export * from './feedback.ts';
export * from './platform.ts';
