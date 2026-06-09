/**
 * The frozen public API surface for field-ui `0.x` — the single data source shared by the lock
 * (`scripts/check-api-surface.mjs`) and the docs page (`/docs/api/stability`). The prose contract is
 * `docs/canonical/field-ui-api-stability.md`; the hard type/value gate is `scripts/api-surface.ts`.
 *
 * Editing this list changes the public contract. Per the compatibility rules below, removing,
 * renaming, or changing the kind/shape of any frozen entry is a BREAKING change (a 0.MINOR bump in
 * the 0.x line) and needs a CHANGELOG migration note. Additions are fine in a PATCH.
 *
 * Package npm names: core = `field-ui`, others = `@field-ui/{platform,elements,react,vanilla}`.
 */

/** Frozen value exports — functions/consts that must remain importable, with their owning package. */
export const FROZEN_VALUES = [
  { pkg: '@field-ui/core', name: 'createField', note: 'host-required primitive — throws without opts.host (the renderer-agnostic door).' },
  { pkg: '@field-ui/core', name: 'compileRecipe', note: 'pure FieldRecipe → compiled plan (no DOM).' },
  { pkg: '@field-ui/platform', name: 'browserHost', note: 'the canonical DOM FieldHost for core.createField.' },
  { pkg: '@field-ui/platform', name: 'createFieldPlatform', note: 'wires the six native-first registries on a root.' },
  { pkg: '@field-ui/platform', name: 'applyRecipe', note: 'applies a recipe to a live platform (compileRecipe lives in core).' },
  { pkg: '@field-ui/platform', name: 'bindData', note: 'binds records → bodies; data drives the field.' },
  { pkg: '@field-ui/vanilla', name: 'createField', note: 'host-bundled convenience = createBrowserField (auto-supplies browserHost).' },
  { pkg: '@field-ui/vanilla', name: 'browserHost', note: 're-export of the platform host for the no-framework path.' },
];

/** Frozen type exports — interfaces that must remain exported, with their owning package. */
export const FROZEN_TYPES = [
  { pkg: '@field-ui/core', name: 'FieldRecipe', note: 'the recipe schema (recipes/schema.ts).' },
  { pkg: '@field-ui/core', name: 'FieldHost', note: 'the renderer-agnostic host contract createField requires; browserHost implements it.' },
  { pkg: '@field-ui/platform', name: 'FieldPlatform', note: 'the surface createFieldPlatform returns.' },
];

/** Frozen custom-element tag names, owned by @field-ui/elements (field-* names; forces-* are deprecated aliases). */
export const FROZEN_ELEMENTS = [
  { pkg: '@field-ui/elements', tag: 'field-root', note: 'one background field per page; scans the document for [data-body]. Alias of deprecated <forces-field>.' },
  { pkg: '@field-ui/elements', tag: 'field-cell', note: 'a scoped local field region. Alias of deprecated <forces-cell>.' },
];

/**
 * The body contract is an ATTRIBUTE, not an element. "Every element is a body" via `data-body` on
 * ordinary elements (core BODY_SELECTOR). There is NO <field-body> tag and one must not be introduced
 * as the body mechanism.
 */
export const FROZEN_BODY_ATTR = 'data-body';

/** Experimental surface — explicitly NOT frozen; may change shape or be removed in any release. */
export const EXPERIMENTAL = [
  { item: 'FieldHandle — full shape', status: 'partial', note: 'The entry points that return FieldHandle are frozen; the handle shape itself is not. New methods may be added in any patch.' },
  { item: 'FieldHandle.particleCount() / .energy()', status: 'partial', note: 'Shipped in @field-ui/core and proxied on <field-root>. Safe to use; signatures may refine before 1.0 as FieldPerf is designed.' },
  { item: 'FieldHandle.scrollV()', status: 'partial', note: 'Shipped in @field-ui/core; returns the engine\'s EMA scroll velocity. Mirrored as --field-scroll-v on :root by the platform runtime. Signature stable; semantics (unit, EMA factor) may refine before 1.0.' },
  { item: 'performance budget (inspectBudget / DEFAULT_BUDGET)', status: 'partial', note: 'inspectBudget(), withinBudget(), BudgetFinding, and DEFAULT_BUDGET ship in @field-ui/core. FieldPerf (frame-duration split, adaptive governor) is designed but not yet implemented.' },
  { item: 'advanced diagnostics', status: 'partial', note: 'DIAGNOSTICS / DIAGNOSTIC_LENS / draw* primitives ship today but are shipped-but-unfrozen until added here.' },
  { item: 'visual recipe editor', status: 'absent', note: 'no editor UI; the authoring toolkit (compileRecipe/recipeAuthoring/validateRecipe) is the substrate to build one on.' },
  { item: 'GPU / WebGPU backend', status: 'planned', note: 'a named direction (VisualBindingRegistry mentions WebGL); the six shipped render modes are CPU/canvas.' },
  { item: 'multi-root bridge', status: 'absent', note: 'no API for coordinating multiple <field-root> instances yet.' },
  { item: 'AI evidence fields', status: 'partial', note: 'EVIDENCE_FIELD + the agent API ship as a substrate, but no packaged feature; unfrozen.' },
  { item: 'custom render backends', status: 'partial', note: 'a custom backend is possible via opts.host, but there is no stable backend-registration API.' },
];

/** Compatibility rules for the 0.x line. */
export const COMPAT_RULES = [
  'Pre-1.0 semver: in 0.x the MINOR is the breaking position. A breaking change to any frozen symbol bumps 0.MINOR (e.g. 0.2 → 0.3); additive and fix-only changes bump PATCH. Consumers should pin to ~0.MINOR.',
  'The stable surface is additive-only within a 0.MINOR line: new exports, new optional fields, and new recipes/modes may land in a PATCH; renaming, removing, or changing the signature/shape of a frozen symbol requires a MINOR bump and a migration note.',
  'createField is frozen in BOTH field-ui (host-required primitive; throws without opts.host) and @field-ui/vanilla (host-bundled convenience). Both contracts are preserved; the vanilla door must keep auto-supplying browserHost.',
  'Package ownership is part of the contract and must not drift within 0.x: compileRecipe / FieldRecipe / FieldHost are core (field-ui); createFieldPlatform / applyRecipe / bindData / FieldPlatform / browserHost are @field-ui/platform; field-root / field-cell are @field-ui/elements.',
  'Bodies are a stable ATTRIBUTE contract: [data-body] on ordinary elements is the frozen authoring surface. There is no <field-body> tag and none will be introduced as the body mechanism.',
  'forces-* → field-* alias window (deprecated, removal-gated): <forces-field>/<forces-cell>, ForcesField/ForcesCell/ForcesController, useForcesField, forces:* events, --forces-* vars, and the compat-* packages keep working behavior-identically through 0.x and emit @deprecated guidance, but are excluded from the additive-only guarantee and scheduled for removal on a MINOR bump with a CHANGELOG entry.',
  'The experimental surface carries no semver guarantee. Diagnostics/agent/render-mode exports that happen to ship today are shipped-but-unfrozen — treat them as experimental until explicitly added to the frozen list.',
];
