/**
 * `<field-root>` option-forwarding drift guard. The `OPTIONS` table drives the engine-option object
 * built in `start()`; `observedAttributes` is an explicit literal (the Custom-Elements-Manifest
 * analyzer reads it statically and can't enumerate a computed array). These tests pin the two
 * together, so a forwarded option can never be observed-but-not-forwarded — the drift that once
 * silently dropped `FieldOptions.depth` from the element entirely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField } from './index.ts';

// OPTIONS is TS-private; reach it at runtime (TS `private` is compile-time only).
const OPTIONS = (FieldField as unknown as { OPTIONS: ReadonlyArray<{ key: string; attr: string }> }).OPTIONS;

test('option-attrs-observed: every forwarded option attr is in observedAttributes', () => {
  const observed = new Set(FieldField.observedAttributes);
  for (const o of OPTIONS) {
    assert.ok(
      observed.has(o.attr),
      `option attr "${o.attr}" is in the OPTIONS table but missing from observedAttributes (it would be forwarded but never re-applied on change)`,
    );
  }
});

// The forward-direction guard: every FieldOptions key <field-root> forwards must have an OPTIONS row.
// This is the reverse of the test above and is what would have caught the original `depth` drop — a
// FieldOptions key silently missing from the OPTIONS table (forwarded by nobody). accent /
// overlayCanvas / feedbackSink are special-cased in start() and intentionally NOT in OPTIONS.
const FORWARDED_OPTION_KEYS = [
  'density', 'waves', 'depth', 'background', 'render', 'overlay',
  'palette', 'mass', 'attention', 'causality', 'heatmap', 'dprCap',
  'waveStyle', 'waveCenter', 'integrator',
] as const;

test('every forwardable FieldOptions key has an OPTIONS row (reverse drift guard)', () => {
  const keys = new Set(OPTIONS.map((o) => o.key));
  for (const key of FORWARDED_OPTION_KEYS) {
    assert.ok(
      keys.has(key),
      `FieldOptions key "${key}" is forwarded by <field-root> but missing from the OPTIONS table (it would never be re-applied — the bug that silently dropped depth)`,
    );
  }
});

test('depth is both forwarded and observed (regression: <field-root depth> was a no-op)', () => {
  assert.ok(
    OPTIONS.some((o) => o.key === 'depth' && o.attr === 'depth'),
    'depth must be a forwarded option in the OPTIONS table',
  );
  assert.ok(FieldField.observedAttributes.includes('depth'), 'depth must be an observed attribute');
});

// The renderMode getter is pure (reads getAttribute) — exercise it via the prototype with a stub
// `this`, no DOM needed. Pins the signals-first default (#538): no/unknown render ⇒ 'none'.
const renderModeGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'renderMode')!.get!;
const renderModeFor = (attr: string | null): string => renderModeGet.call({ getAttribute: () => attr });

test('renderMode defaults to signals-only "none" when the attribute is absent (#538)', () => {
  assert.equal(renderModeFor(null), 'none', 'no render attribute ⇒ signals-first default');
  assert.equal(renderModeFor('nonsense'), 'none', 'an unrecognized value falls back to none, not dots');
});

test('renderMode passes through every recognized drawing mode', () => {
  for (const m of ['dots', 'trails', 'links', 'metaballs', 'voronoi', 'streamlines', 'flow', 'none']) {
    assert.equal(renderModeFor(m), m, `render="${m}" passes through`);
  }
});
