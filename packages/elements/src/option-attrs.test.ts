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

test('depth is both forwarded and observed (regression: <field-root depth> was a no-op)', () => {
  assert.ok(
    OPTIONS.some((o) => o.key === 'depth' && o.attr === 'depth'),
    'depth must be a forwarded option in the OPTIONS table',
  );
  assert.ok(FieldField.observedAttributes.includes('depth'), 'depth must be an observed attribute');
});
