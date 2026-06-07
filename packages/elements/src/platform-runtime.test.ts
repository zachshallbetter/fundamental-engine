/**
 * Phase D1 — the platform-runtime flag decision. The rAF runtime itself is thin DOM glue
 * (browser-verified); the branch point `<field-root>` uses is pure and tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldUsePlatformRuntime, usePlatformRuntime, isPlatformRuntimeDefault } from './platform-runtime.ts';

/** Minimal element stub with attribute access. */
function el(attrs: Record<string, string> = {}): { getAttribute(n: string): string | null; hasAttribute(n: string): boolean } {
  return { getAttribute: (n) => attrs[n] ?? null, hasAttribute: (n) => n in attrs };
}

test('default is on (D6), so an unflagged element uses the platform path', () => {
  assert.equal(isPlatformRuntimeDefault(), true);
  assert.equal(shouldUsePlatformRuntime(el()), true);
  // an explicit def arg still overrides for callers that pass one
  assert.equal(shouldUsePlatformRuntime(el(), false), false);
});

test('an explicit experimental-platform attribute opts a single element in', () => {
  assert.equal(shouldUsePlatformRuntime(el({ 'experimental-platform': '' }), false), true);
  assert.equal(shouldUsePlatformRuntime(el({ 'experimental-platform': 'true' }), false), true);
});

test('experimental-platform="off" opts out even when the default is on', () => {
  assert.equal(shouldUsePlatformRuntime(el({ 'experimental-platform': 'off' }), true), false);
});

test('with no attribute, the global default decides', () => {
  assert.equal(shouldUsePlatformRuntime(el(), true), true);
  assert.equal(shouldUsePlatformRuntime(el(), false), false);
});

test('usePlatformRuntime toggles the global default both ways', () => {
  usePlatformRuntime(false);
  assert.equal(isPlatformRuntimeDefault(), false);
  assert.equal(shouldUsePlatformRuntime(el()), false, 'unflagged element follows the legacy path when off');
  usePlatformRuntime(true); // restore the D6 default
  assert.equal(isPlatformRuntimeDefault(), true);
});
