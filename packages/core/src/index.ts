/**
 * Fundamental — a reciprocal DOM-physics field.
 *
 * Elements bend the field; the field's density bends them back.
 * Spec: `docs/engine-reference/forces-system.md`.
 *
 * Feature-complete: the catalog, core contracts, FieldStore, integrator, and the
 * full force set (canonical · natural · designed-extended). Zero runtime dependencies.
 */

export * from './engine/types.ts';
export * from './version.ts';
export * from './config/forces.config.ts';
export * from './config/manual.ts';
export * from './config/palettes.ts';
export * from './config/themes.ts';
export * from './config/tokens.ts';
export * from './math/math.ts';
export * from './math/geometry.ts';
export * from './engine/feedback.ts';
export * from './engine/attention.ts';
export * from './engine/causality.ts';
export * from './engine/field-snapshot.ts';
export * from './engine/governance.ts';
export * from './engine/lane-registry.ts';
export * from './engine/projection-agent-json.ts';
export * from './engine/query-lens.ts';
export * from './engine/streamlines.ts';
export * from './engine/flow.ts';
export * from './engine/fieldlines.ts';
export * from './engine/fieldline-seeds.ts';
export * from './engine/reactions.ts';
export * from './engine/agents.ts';
export * from './engine/currents.ts';
export * from './engine/reservoir.ts';
export * from './engine/spatial-hash.ts';
export * from './engine/temporal.ts';
export * from './engine/weights.ts';
export * from './engine/thermo.ts';
export * from './engine/field-store.ts';
export * from './engine/conditions.ts';
export * from './engine/events.ts';
export * from './engine/registry.ts';
export * from './engine/integrator.ts';
export * from './engine/formations.ts';
export * from './engine/scanner.ts';
export * from './engine/shadow.ts';
export * from './engine/render-modes.ts';
export * from './engine/heatmap.ts';
export * from './engine/surface.ts';
export * from './engine/host.ts';
// headlessHost — the DOM-free reference host for non-visual consumers (agents, native sidecars, tests).
export * from './engine/host-headless.ts';
// RenderBackend (#373): the structural drawing seam alongside FieldHost. Exported so an external
// surface (WebGL/WebGPU/Three.js — see @fundamental-engine/three) can implement the contract by name and
// inject it via `createField({ overlayBackend })`.
export * from './engine/render-backend.ts';
// The CSS feedback adapter — feedback is plain data first; this writes channels to CSS vars (the
// DOM door's default). Non-DOM hosts pass their own FeedbackSink instead.
export { cssFeedbackSink } from './engine/feedback-sink.ts';
export * from './engine/field.ts';
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
