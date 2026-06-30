import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { replayFieldSnapshots } from './field-snapshot.ts';
import type { FieldHost } from './host.ts';

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

test('replay-force: includeInfluences captures per-body force attribution (off by default)', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], strength: 1, range: 260, data: { id: 'A' }, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  for (let i = 0; i < 5; i++) tick();
  assert.equal(field.snapshot().influences, undefined, 'no influences by default');
  const snap = field.snapshot({ includeInfluences: true });
  assert.ok(Array.isArray(snap.influences) && snap.influences.length > 0, 'influences captured on request');
  assert.ok(snap.influences!.every((i) => typeof i.source === 'string' && typeof i.force === 'string'), 'shaped influences');
  field.destroy();
});

test('replay-force: a force that leaves between snapshots produces a cause:force step (released)', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], strength: 1, range: 260, data: { id: 'A' }, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  const b = field.addBody({ tokens: ['attract'], strength: 1, range: 200, data: { id: 'B' }, rect: () => ({ left: 60, top: 60, width: 30, height: 30 }) });
  for (let i = 0; i < 5; i++) tick();

  const before = field.snapshot({ includeInfluences: true });
  b.remove(); // body B (and its attract) leaves the field
  for (let i = 0; i < 5; i++) tick();
  const after = field.snapshot({ includeInfluences: true });

  const r = replayFieldSnapshots(before, after);
  const forceSteps = r.steps.filter((s) => s.cause === 'force');
  assert.ok(forceSteps.length > 0, 'at least one force-attribution step');
  assert.ok(forceSteps.some((s) => /attract on .* released/.test(s.description)), `B's attract released: ${forceSteps.map((s) => s.description).join(' | ')}`);
  // a measurement step also records B leaving — both lanes present
  assert.ok(r.steps.some((s) => s.cause === 'measurement' && /left the field/.test(s.description)));
  field.destroy();
});

test('replay-force: no force steps when influences were not captured', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], strength: 1, rect: () => ({ left: 100, top: 100, width: 20, height: 20 }) });
  for (let i = 0; i < 3; i++) tick();
  const a = field.snapshot(); // no influences
  const b = field.snapshot();
  assert.ok(replayFieldSnapshots(a, b).steps.every((s) => s.cause !== 'force'), 'no force lane without captured influences');
  field.destroy();
});
