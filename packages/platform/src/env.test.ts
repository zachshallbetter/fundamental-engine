/**
 * env helper unit tests — SSR-safe defaults and the override seam.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefersReducedMotion, pageHidden, setEnvOverrides, clearEnvOverrides } from './env.ts';

test('prefersReducedMotion returns false when matchMedia is absent (SSR)', () => {
  const g = globalThis as Record<string, unknown>;
  const had = 'matchMedia' in g;
  const prev = g.matchMedia;
  delete g.matchMedia;
  try {
    assert.equal(prefersReducedMotion(), false);
  } finally {
    if (had) g.matchMedia = prev;
  }
});

test('prefersReducedMotion reads from matchMedia when available', () => {
  const g = globalThis as Record<string, unknown>;
  const prev = g.matchMedia;
  g.matchMedia = (_q: string) => ({ matches: true });
  try {
    assert.equal(prefersReducedMotion(), true);
  } finally {
    if (prev !== undefined) g.matchMedia = prev;
    else delete g.matchMedia;
  }
});

test('pageHidden returns false when document is absent (SSR)', () => {
  // Node test runner: document is not defined by default
  if (typeof document === 'undefined') {
    assert.equal(pageHidden(), false);
  } else {
    // in a DOM environment just verify the function runs without error
    assert.equal(typeof pageHidden(), 'boolean');
  }
});

test('setEnvOverrides: reducedMotion override wins over matchMedia', () => {
  const g = globalThis as Record<string, unknown>;
  const prev = g.matchMedia;
  g.matchMedia = (_q: string) => ({ matches: false }); // live says false
  setEnvOverrides({ reducedMotion: true }); // override says true
  try {
    assert.equal(prefersReducedMotion(), true, 'override wins');
  } finally {
    clearEnvOverrides();
    if (prev !== undefined) g.matchMedia = prev;
    else delete g.matchMedia;
  }
});

test('setEnvOverrides: hidden override wins over document.hidden', () => {
  setEnvOverrides({ hidden: true });
  try {
    assert.equal(pageHidden(), true, 'override wins');
  } finally {
    clearEnvOverrides();
  }
});

test('clearEnvOverrides restores live behaviour', () => {
  const g = globalThis as Record<string, unknown>;
  const prev = g.matchMedia;
  g.matchMedia = (_q: string) => ({ matches: false });
  setEnvOverrides({ reducedMotion: true });
  clearEnvOverrides();
  try {
    assert.equal(prefersReducedMotion(), false, 'live matchMedia used after clear');
  } finally {
    if (prev !== undefined) g.matchMedia = prev;
    else delete g.matchMedia;
  }
});

test('setEnvOverrides is shallow-merge: setting one field leaves the other live', () => {
  setEnvOverrides({ reducedMotion: true });
  setEnvOverrides({ hidden: true });
  try {
    assert.equal(prefersReducedMotion(), true, 'reducedMotion override preserved after second call');
    assert.equal(pageHidden(), true, 'hidden override set by second call');
  } finally {
    clearEnvOverrides();
  }
});
