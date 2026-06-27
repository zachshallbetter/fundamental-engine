/**
 * Fundamental — a reciprocal DOM-physics field.
 *
 * Elements bend the field; the field's density bends them back.
 * Spec: `docs/engine-reference/forces-system.md`. Roadmap: `ROADMAP.md`.
 *
 * Feature-complete: the catalog, core contracts, FieldStore, integrator, and the
 * full force set (canonical · natural · designed-extended). Zero runtime dependencies.
 */

export * from './core/types.ts';
export * from './version.ts';
export * from './config/forces.config.ts';
export * from './config/manual.ts';
export * from './config/palettes.ts';
export * from './config/themes.ts';
export * from './config/tokens.ts';
export * from './core/math.ts';
export * from './core/geometry.ts';
export * from './core/feedback.ts';
export * from './core/attention.ts';
export * from './core/causality.ts';
export * from './core/streamlines.ts';
export * from './core/flow.ts';
export * from './core/fieldlines.ts';
export * from './core/fieldline-seeds.ts';
export * from './core/reactions.ts';
export * from './core/agents.ts';
export * from './core/currents.ts';
export * from './core/reservoir.ts';
export * from './core/spatial-hash.ts';
export * from './core/temporal.ts';
export * from './core/weights.ts';
export * from './core/thermo.ts';
export * from './core/field-store.ts';
export * from './core/conditions.ts';
export * from './core/events.ts';
export * from './core/registry.ts';
export * from './core/integrator.ts';
export * from './core/formations.ts';
export * from './core/scanner.ts';
export * from './core/shadow.ts';
export * from './core/render-modes.ts';
export * from './core/heatmap.ts';
export * from './core/surface.ts';
export * from './core/host.ts';
// headlessHost — the DOM-free reference host for non-visual consumers (agents, native sidecars, tests).
export * from './core/host-headless.ts';
// RenderBackend (#373): the structural drawing seam alongside FieldHost. Exported so an external
// surface (WebGL/WebGPU/Three.js — see @fundamental-engine/three) can implement the contract by name and
// inject it via `createField({ overlayBackend })`.
export * from './core/render-backend.ts';
// The CSS feedback adapter — feedback is plain data first; this writes channels to CSS vars (the
// DOM door's default). Non-DOM hosts pass their own FeedbackSink instead.
export { cssFeedbackSink } from './core/feedback-sink.ts';
export * from './core/field.ts';
export * from './forces/index.ts';
// physics conformance — the Lab-as-detector framework (shared by tests + the Lab UI)
export * from './conformance/types.ts';
export * from './conformance/run.ts';
export * from './conformance/expectations.ts';
export * from './conformance/experiments.ts';
// formal contracts (Phase 4) — contract types, force passports, and dev-mode enforcement guards
export * from './contracts/index.ts';
// the FieldAgent model (Phase 5) — element/relationship/user/layout/data agents + event thresholder
export * from './agents/index.ts';
// the visual language layer (Phase 6) — metric→appearance mappings, lint rules, semantic-text
export * from './visual/index.ts';
// authoring & recipes (Phase 7) — FieldRecipe schema, intent compiler, gallery, explain/diff
export * from './recipes/index.ts';
// inspection & productization (Phase 8) — snapshot regression, budget inspector, system report
export * from './inspect/index.ts';
// the semantic layer (BA2) — meaning→metric maps, interaction materials, field states
export * from './semantic/index.ts';
// diagnostics (B4) — energy, potential, probe force-vectors + causality, heatmap variants
export * from './diagnostics/index.ts';
// field export (C4) — PNG raster + SVG vector serialization + download helpers
export * from './export.ts';
// record / replay (#692) — seeded, headless capture of per-frame particle state (readParticles wire
// format) + deterministic reproduction for debugging and regression tests
export * from './record/index.ts';
