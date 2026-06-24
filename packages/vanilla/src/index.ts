/**
 * `@fundamental-engine/vanilla` — the framework-free TypeScript door to the reciprocal field.
 *
 * The same engine the `<field-root>` custom element and the React `<FieldField>` wrap,
 * exposed as a typed `FieldField` class and the imperative `mountField()` / `createField()`,
 * with **no** custom-element registration and **no** framework dependency. This package has
 * no side effects: importing it never defines a custom element. Reach for it from plain
 * TypeScript, or any stack where you want to drive the field by hand.
 *
 * Spec: `docs/engine-reference/forces-system.md`.
 */

export { FieldField } from './field.ts';
export type { FieldFieldInit } from './field.ts';
export { mountField, makeFieldCanvas } from './mount.ts';
export type { MountOptions } from './mount.ts';

// The one imperative engine entry (core is renderer-agnostic and requires a host). `createField`
// resolves the host from `opts.host` → `bounds` (contained) → `browserHost()` (default), so the
// framework-free door stays a one-liner while reaching the contained/custom-host modes. `browserHost`
// is re-exported for explicit custom wiring.
export { createField } from './create-field.ts';
export type { CreateFieldOptions } from './create-field.ts';
export { browserHost } from '@fundamental-engine/dom';
// headlessHost — the DOM-free host for non-visual consumers (agent / native / Node), beside createField.
export { headlessHost } from '@fundamental-engine/core';
export type { HeadlessHost, HeadlessHostOptions } from '@fundamental-engine/core';
export type {
  FieldHandle,
  FieldOptions,
  ThreadLink,
  Particle,
  Body,
  Force,
  Formation,
  Vec2,
  AgentSpec,
  AgentHandle,
  AtomPayload,
  FeedbackSink,
  FeedbackChannels,
} from '@fundamental-engine/core';
// the feedback CSS adapter, for a host that wants the default DOM write path explicitly.
export { cssFeedbackSink } from '@fundamental-engine/core';

// The catalog data a vanilla UI commonly reads — the force list, formations, `data-when`
// gates, and the palette — so a force picker or legend needs no second install.
export { FORCES, FORMATIONS, CONDITIONS, PALETTE } from '@fundamental-engine/core';
