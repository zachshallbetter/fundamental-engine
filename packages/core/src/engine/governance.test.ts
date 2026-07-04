import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintProjections } from './governance.ts';
import { createField } from './field.ts';
import type { FieldProjectionInfo } from './types.ts';
import type { FieldHost } from './host.ts';

function tickHost(width: number, height: number): FieldHost {
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  return {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: () => {},
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
}

const proj = (over: Partial<FieldProjectionInfo>): FieldProjectionInfo => ({
  id: 'p', label: 'P', channels: ['density'], surfaces: ['css'], ...over,
});

test('governance: a motion-capable projection without a reduced-motion equivalent is an error', () => {
  const w = lintProjections([proj({ id: 'motion', surfaces: ['css', 'canvas'], accessibilityEquivalent: 'a' })]);
  const rm = w.find((x) => x.rule === 'field/reduced-motion-equivalent-required');
  assert.ok(rm, 'flagged');
  assert.equal(rm!.severity, 'error', 'accessibility-contract violation → error');
  assert.equal(rm!.subject, 'motion');
});

test('governance: any projection without an accessibility equivalent is a warning', () => {
  const w = lintProjections([proj({ id: 'noa11y', reducedMotionEquivalent: 'outline' })]);
  const a = w.find((x) => x.rule === 'field/accessibility-equivalent-required');
  assert.ok(a && a.severity === 'warning' && a.subject === 'noa11y');
});

test('governance: a fully-compliant projection produces no warnings', () => {
  const w = lintProjections([proj({ id: 'good', surfaces: ['css'], reducedMotionEquivalent: 'outline', accessibilityEquivalent: 'label' })]);
  assert.equal(w.length, 0);
});

test('governance: a non-motion surface (agent-json) needs no reduced-motion equivalent', () => {
  const w = lintProjections([proj({ id: 'data', surfaces: ['agent-json'], accessibilityEquivalent: 'json' })]);
  assert.equal(w.length, 0, 'agent-json is non-motion + has a11y equivalent → clean');
});

test('governance: field.projections.lint() delegates to lintProjections over the live registry', () => {
  const field = createField(undefined as never, { host: tickHost(400, 300), render: 'none' });
  field.projections.register({ id: 'm', label: 'M', channels: ['density'], surfaces: ['css'] }); // motion, no equivalents
  const w = field.projections.lint();
  assert.ok(w.some((x) => x.rule === 'field/reduced-motion-equivalent-required' && x.subject === 'm'));
  assert.ok(w.some((x) => x.rule === 'field/accessibility-equivalent-required' && x.subject === 'm'));
  field.destroy();
});
