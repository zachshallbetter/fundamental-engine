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
import type { FieldOptions } from '@fundamental-engine/core';

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

// The reverse-direction guard: every OBSERVED attribute (other than the handful the element special-cases
// outside the OPTIONS table) must have an OPTIONS row, so it is forwarded at boot AND re-applied on change.
// This is the drift that once silently dropped `depth` — an attribute observed + wired in
// attributeChangedCallback but forgotten in OPTIONS, so `<field-root depth>` was a boot no-op.
//
// The checked set is DERIVED from `observedAttributes` (minus the special allowlist), NOT a hand-maintained
// literal — the old literal had fallen behind the table (it never listed grid-warp / grid-intensity / theme /
// gradient* / wave-baseline / separation), so a regression in any of those forwarded options would have
// slipped past. Deriving it means a newly-observed forwarded attribute is checked automatically.
//
// SPECIAL_ATTRS are observed but intentionally have no OPTIONS row: they are wired directly (accent is applied
// in start() / setAccent; formation is a post-boot command, not a construction option). accent / overlayCanvas /
// feedbackSink live outside OPTIONS by design.
const SPECIAL_ATTRS = new Set(['accent', 'formation']);

test('every observed (non-special) attribute has an OPTIONS row (reverse drift guard)', () => {
  const optionAttrs = new Set(OPTIONS.map((o) => o.attr));
  const derived = FieldField.observedAttributes.filter((a) => !SPECIAL_ATTRS.has(a));
  // sanity: the derivation is non-empty and doesn't accidentally allowlist everything away
  assert.ok(derived.length > 5, 'derived attribute set collapsed — the allowlist or observedAttributes changed shape');
  for (const attr of derived) {
    assert.ok(
      optionAttrs.has(attr),
      `observed attribute "${attr}" has no OPTIONS row — it is watched + re-applied on change but never forwarded at boot (the bug that made <field-root ${attr}> a boot no-op, like depth). Add it to OPTIONS, or to SPECIAL_ATTRS if it is intentionally wired outside the table.`,
    );
  }
});

// Companion spot-check on the OPTION KEYS (not just the attrs): the OPTIONS table maps each observed
// attribute to a `FieldOptions` key it forwards. TypeScript already pins `key: keyof FieldOptions` on the
// table declaration, so this guards the runtime shape and, deliberately, names the forwarded keys so the
// RC-6 contract-coverage corpus scan sees a top-level reference to each (the scan is non-recursive, and
// these keys — waveStyle, waveCenter, dprCap among them — are exercised elsewhere only in sub-dir tests).
const FORWARDED_KEYS: readonly (keyof FieldOptions)[] = [
  'density', 'waves', 'depth', 'background', 'render', 'overlay', 'palette', 'mass',
  'attention', 'causality', 'heatmap', 'dprCap', 'gridWarp', 'gridIntensity', 'theme',
  'gradientCool', 'gradientWarm', 'waveBaseline', 'waveStyle', 'waveCenter', 'separation', 'integrator',
];

test('every declared forwarded FieldOptions key has an OPTIONS row', () => {
  const keys = new Set(OPTIONS.map((o) => o.key));
  for (const key of FORWARDED_KEYS) {
    assert.ok(
      keys.has(key),
      `FieldOptions key "${String(key)}" is expected to be forwarded by <field-root> but has no OPTIONS row (it would never be applied — the bug that silently dropped depth).`,
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

// Same pure-getter pattern for the integrator attribute (#659): both opt-in modes pass through;
// anything else (incl. absent) is undefined, so createField falls back to the default 'legacy'.
const integratorGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'integrator')!.get!;
const integratorFor = (attr: string | null): string | undefined =>
  integratorGet.call({ getAttribute: () => attr });

test('integrator accepts both opt-in modes and rejects everything else (#659)', () => {
  assert.equal(integratorFor('fixed'), 'fixed', 'integrator="fixed" passes through');
  assert.equal(integratorFor('velocity-verlet'), 'velocity-verlet', 'integrator="velocity-verlet" passes through');
  assert.equal(integratorFor(null), undefined, 'absent ⇒ undefined (legacy default)');
  assert.equal(integratorFor('nonsense'), undefined, 'unknown value ⇒ undefined (legacy default)');
});

// Same pure-getter pattern for the waves attribute (#979, doc-06 Step 0): the Currents are OPT-IN.
// Absent ⇒ off (the bare field, mirroring the core `waves` default); present (and not "false") ⇒ on.
const wavesGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'waves')!.get!;
const wavesFor = (attr: string | null): boolean =>
  wavesGet.call({ hasAttribute: () => attr !== null, getAttribute: () => attr });

test('waves defaults OFF when the attribute is absent — the Currents are opt-in (#979)', () => {
  assert.equal(wavesFor(null), false, 'no waves attribute ⇒ the bare field, no Currents');
  assert.equal(wavesFor(''), true, 'bare boolean attribute presence ⇒ waves on');
  assert.equal(wavesFor('true'), true, 'waves="true" ⇒ on');
  assert.equal(wavesFor('false'), false, 'waves="false" stays an explicit opt-out');
});
