/**
 * `FieldField` delegation drift guard. `FieldField implements FieldHandle`, so the compiler already
 * requires every handle method to EXIST on the class. What the type system does NOT catch is a
 * method that appears at RUNTIME on a concrete `FieldHandle` (built by `createField`) but was never
 * hand-forwarded on `FieldField` — a class can satisfy `implements FieldHandle` through inherited /
 * structurally-compatible members while a specific delegate is silently missing, so `field.foo()`
 * would resolve to something other than the wrapped handle's `foo`.
 *
 * This test compares the method surface of a real headless handle against `FieldField.prototype`,
 * so a new `FieldHandle` method that lands without a matching `FieldField` delegate fails here
 * regardless of how the type happens to line up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, headlessHost } from './index.ts';
import { FieldField } from './field.ts';

// Method names on a concrete handle, built DOM-free (no browser, no canvas).
function handleMethods(): Set<string> {
  const host = headlessHost({ width: 200, height: 200 });
  const handle = createField(undefined as never, { host, render: 'none' });
  const names = new Set<string>();
  for (const k of Object.keys(handle) as Array<keyof typeof handle>) {
    if (typeof handle[k] === 'function') names.add(k as string);
  }
  handle.destroy();
  return names;
}

// Method names FieldField actually declares (own prototype only — not Object.prototype).
function fieldFieldMethods(): Set<string> {
  const names = new Set<string>();
  for (const k of Object.getOwnPropertyNames(FieldField.prototype)) {
    if (k === 'constructor') continue;
    const d = Object.getOwnPropertyDescriptor(FieldField.prototype, k)!;
    if (typeof d.value === 'function') names.add(k);
  }
  return names;
}

test('FieldField delegates every FieldHandle method (vanilla delegation drift)', () => {
  const handle = handleMethods();
  const wrapper = fieldFieldMethods();
  assert.ok(handle.size > 10, `sanity: expected a rich handle surface, got ${handle.size} methods`);

  const missing = [...handle].filter((m) => !wrapper.has(m)).sort();
  assert.deepEqual(
    missing,
    [],
    `FieldField is missing a delegate for these FieldHandle methods: ${missing.join(', ')}. ` +
      `Add a forwarding method on FieldField (packages/vanilla/src/field.ts) that calls this.field.<name>(...).`,
  );
});
