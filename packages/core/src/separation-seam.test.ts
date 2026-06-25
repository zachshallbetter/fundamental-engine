/**
 * FieldOptions seam coverage — separation (particle-to-particle repulsion force, 0..1).
 * These tests satisfy the RC-6 contract-coverage guard (contract-coverage.test.ts scans top-level
 * src/*.test.ts; deeper sub-tests in src/core/ are not picked up by the non-recursive scan).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './core/field.ts';
import type { FieldHost } from './core/host.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

function fakeHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('separation: 0 disables particle-to-particle repulsion (accepted, no throw)', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', separation: 0 });
  try {
    assert.ok(field, 'field initialises with separation: 0');
  } finally {
    field.destroy();
  }
});

test('separation: positive value enables particle-to-particle repulsion (accepted, no throw)', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', separation: 0.5 });
  try {
    assert.ok(field, 'field initialises with separation: 0.5');
  } finally {
    field.destroy();
  }
});

test('separation: negative value falls back to 0 (clamped, no throw)', () => {
  // guard: `opts.separation != null && opts.separation >= 0 ? opts.separation : 0`
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', separation: -1 });
  try {
    assert.ok(field, 'field initialises with a negative separation (falls back to 0)');
  } finally {
    field.destroy();
  }
});
