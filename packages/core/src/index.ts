/**
 * forces-ui — a reciprocal DOM-physics field.
 *
 * Elements bend the field; the field's density bends them back.
 * Spec: `docs/forces-system.md`. Roadmap: `ROADMAP.md`.
 *
 * Status: pre-alpha. The canonical catalog and core contracts are in place;
 * the engine (FieldStore, integrator, force modules) is being refactored from
 * the prototype in `docs/reference/`.
 */

export * from './core/types.ts';
export * from './config/forces.config.ts';
export * from './core/math.ts';
export * from './core/feedback.ts';
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
export * from './core/field.ts';
export * from './forces/index.ts';
