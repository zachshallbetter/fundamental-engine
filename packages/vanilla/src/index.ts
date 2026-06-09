/**
 * `@field-ui/vanilla` — the framework-free TypeScript door to the reciprocal field.
 *
 * The same engine the `<forces-field>` custom element and the React `<ForcesField>` wrap,
 * exposed as a typed `ForcesField` class and the imperative `mountField()` / `createField()`,
 * with **no** custom-element registration and **no** framework dependency. This package has
 * no side effects: importing it never defines a custom element. Reach for it from plain
 * TypeScript, or any stack where you want to drive the field by hand.
 *
 * Spec: `docs/engine-reference/forces-system.md`.
 */

export { FieldField, ForcesField } from './field.ts';
export type { FieldFieldInit, ForcesFieldInit } from './field.ts';
export { mountField, makeFieldCanvas } from './mount.ts';
export type { MountOptions } from './mount.ts';

// The engine entry, wired to the browser host (core is renderer-agnostic and requires a host).
// `createBrowserField` = `createField` + `browserHost()`; re-exported here as `createField` so the
// framework-free door stays a one-liner. `browserHost` is re-exported for custom wiring.
export { createBrowserField as createField, browserHost } from '@field-ui/platform';
export type {
  FieldHandle,
  FieldOptions,
  ThreadLink,
  Particle,
  Body,
  Force,
  Formation,
  Vec2,
} from '@field-ui/core';

// The catalog data a vanilla UI commonly reads — the force list, formations, `data-when`
// gates, and the palette — so a force picker or legend needs no second install.
export { FORCES, FORMATIONS, CONDITIONS, PALETTE } from '@field-ui/core';
