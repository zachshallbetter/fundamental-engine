/**
 * registerFieldProperties unit tests — typed --field-density / --d via CSS.registerProperty:
 * feature detection, idempotence, and the graceful no-op when registration throws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerFieldProperties, _resetFieldPropertiesForTest } from './register-properties.ts';

type RegArg = { name: string; syntax: string; inherits: boolean; initialValue: string };
const g = globalThis as Record<string, unknown>;

/** Install a mock `CSS.registerProperty`, run `fn`, restore the original CSS global. */
function withMockCSS(impl: (def: RegArg) => void, fn: () => void): void {
  const had = 'CSS' in g;
  const prev = g.CSS;
  g.CSS = { registerProperty: impl };
  _resetFieldPropertiesForTest();
  try {
    fn();
  } finally {
    if (had) g.CSS = prev;
    else delete g.CSS;
    _resetFieldPropertiesForTest();
  }
}

test('registers --field-density and --d as typed <number> properties', () => {
  const calls: RegArg[] = [];
  withMockCSS((def) => calls.push(def), () => {
    const done = registerFieldProperties();
    assert.deepEqual(done, ['--field-density', '--d']);
  });

  assert.equal(calls.length, 2);
  for (const def of calls) {
    assert.equal(def.syntax, '<number>');
    assert.equal(def.inherits, true);
    assert.equal(def.initialValue, '0');
  }
  assert.deepEqual(calls.map((c) => c.name), ['--field-density', '--d']);
});

test('is a no-op when CSS.registerProperty is unavailable', () => {
  const had = 'CSS' in g;
  const prev = g.CSS;
  delete g.CSS;
  _resetFieldPropertiesForTest();
  try {
    assert.deepEqual(registerFieldProperties(), []);
  } finally {
    if (had) g.CSS = prev;
    _resetFieldPropertiesForTest();
  }
});

test('is idempotent — a second call registers nothing', () => {
  const calls: RegArg[] = [];
  withMockCSS((def) => calls.push(def), () => {
    registerFieldProperties();
    const second = registerFieldProperties();
    assert.deepEqual(second, []);
  });
  assert.equal(calls.length, 2, 'only the first call registers');
});

test('swallows the throw when a property is already registered', () => {
  const calls: RegArg[] = [];
  withMockCSS(
    (def) => {
      calls.push(def);
      throw new DOMException('property already registered', 'InvalidModificationError');
    },
    () => {
      // Must not throw despite registerProperty throwing for each name.
      const done = registerFieldProperties();
      assert.deepEqual(done, []);
    },
  );
  assert.equal(calls.length, 2, 'attempts both names even though each throws');
});
