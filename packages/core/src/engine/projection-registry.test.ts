import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { FieldProjection } from './types.ts';

function tickHost(width: number, height: number): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: (at) => { t = at ?? t + 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

const densityOutline: FieldProjection = {
  id: 'density-outline',
  label: 'Density Outline',
  channels: ['density'],
  surfaces: ['css', 'annotation'],
  reducedMotionEquivalent: 'outline and label',
  accessibilityEquivalent: 'semantic emphasis and explanation',
  apply(reading, target) {
    target.style?.setProperty('--field-outline', String(reading.density));
  },
};

test('projections: register / get / list / unregister', () => {
  const { host } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  const off = field.projections.register(densityOutline);
  assert.equal(field.projections.get('density-outline'), densityOutline, 'get returns the full projection');
  const info = field.projections.list();
  assert.equal(info.length, 1);
  assert.deepEqual(info[0]!.surfaces, ['css', 'annotation']);
  assert.equal(info[0]!.reducedMotionEquivalent, 'outline and label');
  assert.equal((info[0] as { apply?: unknown }).apply, undefined, 'list() metadata omits the apply fn (serializable)');
  off();
  assert.equal(field.projections.list().length, 0, 'the unregister fn removes it');
  field.destroy();
});

test('projections: apply writes to a target — and never mutates the field (separation of projection vs coupling)', () => {
  const { host } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.projections.register(densityOutline);
  const before = field.particleCount();
  const props: Record<string, string> = {};
  field.projections.apply('density-outline', { density: 0.72 }, { style: { setProperty: (k, v) => { props[k] = v; } } });
  assert.equal(props['--field-outline'], '0.72', 'apply wrote the reading to the target surface');
  assert.equal(field.particleCount(), before, 'applying a projection does not change field state');
  field.projections.apply('nope', { density: 1 }, {}); // unknown id is a no-op, no throw
  field.destroy();
});

test('projections: query() and snapshot() report the registered projections', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.projections.register(densityOutline);
  for (let i = 0; i < 3; i++) tick();
  assert.equal(field.query().projections[0]?.id, 'density-outline', 'query reports projections');
  assert.equal(field.snapshot().projections[0]?.label, 'Density Outline', 'snapshot captures projections');
  field.destroy();
});
