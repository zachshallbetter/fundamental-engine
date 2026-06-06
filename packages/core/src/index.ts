/**
 * forces-ui — a reciprocal DOM-physics field.
 *
 * Elements bend the field; the field's density bends them back.
 * Spec: `docs/forces-system.md`. Roadmap: `ROADMAP.md`.
 *
 * Feature-complete: the catalog, core contracts, FieldStore, integrator, and the
 * full force set (canonical · natural · designed-extended). Zero runtime dependencies.
 */

export * from './core/types.ts';
export * from './config/forces.config.ts';
export * from './config/manual.ts';
export * from './config/palettes.ts';
export * from './config/tokens.ts';
export * from './core/math.ts';
export * from './core/geometry.ts';
export * from './core/feedback.ts';
export * from './core/attention.ts';
export * from './core/causality.ts';
export * from './core/streamlines.ts';
export * from './core/reactions.ts';
export * from './core/agents.ts';
export * from './core/currents.ts';
export * from './core/reservoir.ts';
export * from './core/spatial-hash.ts';
export * from './core/field-store.ts';
export * from './core/conditions.ts';
export * from './core/events.ts';
export * from './core/registry.ts';
export * from './core/integrator.ts';
export * from './core/formations.ts';
export * from './core/scanner.ts';
export * from './core/render-modes.ts';
export * from './core/surface.ts';
export * from './core/field.ts';
export * from './forces/index.ts';
// physics conformance — the Lab-as-detector framework (shared by tests + the Lab UI)
export * from './conformance/types.ts';
export * from './conformance/run.ts';
export * from './conformance/expectations.ts';
export * from './conformance/experiments.ts';
