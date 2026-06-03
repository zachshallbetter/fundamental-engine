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

export * from './core/types.js';
export * from './config/forces.config.js';
