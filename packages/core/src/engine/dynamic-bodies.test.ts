import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
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

test('dynamic: a dynamic body recoils — it moves toward an attractor while an anchored one stays put', () => {
  const { host, tick } = tickHost(600, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  // A: a strong anchored attractor on the right. D: a dynamic body on the left, engine-owned.
  field.addBody({ tokens: ['attract'], strength: 2, range: 500, data: { id: 'A' }, rect: () => ({ left: 380, top: 140, width: 40, height: 40 }) }); // centre (400,160)
  const dRectLeft = 100;
  field.addBody({ tokens: ['attract'], strength: 0.5, range: 120, authority: 'dynamic', data: { id: 'D' }, rect: () => ({ left: dRectLeft, top: 140, width: 40, height: 40 }) }); // centre (120,160)

  const id = (q: ReturnType<typeof field.query>, which: string) => q.bodies.find((b) => b.rect && (which === 'D' ? b.authority === 'dynamic' : b.authority !== 'dynamic'))!;
  const start = field.query();
  const dStartX = id(start, 'D').rect!.x;

  for (let i = 0; i < 60; i++) tick();

  const after = field.query();
  const dAfter = id(after, 'D');
  const aAfter = id(after, 'A');
  assert.ok(dAfter.rect!.x > dStartX + 1, `dynamic body moved toward the attractor (${dStartX} → ${dAfter.rect!.x})`);
  assert.equal(dAfter.authority, 'dynamic');
  // the anchored attractor never left its rect (still measured from the DOM at left 380 → x 380).
  assert.ok(Math.abs(aAfter.rect!.x - 380) < 1e-6, 'anchored body stays anchored to its rect');
  field.destroy();
});

test('dynamic: an anchored body ignores the field — its position stays at its rect', () => {
  const { host, tick } = tickHost(600, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], strength: 2, range: 500, rect: () => ({ left: 380, top: 140, width: 40, height: 40 }) });
  field.addBody({ tokens: ['attract'], strength: 0.5, range: 120, rect: () => ({ left: 100, top: 140, width: 40, height: 40 }) }); // anchored (default)
  for (let i = 0; i < 60; i++) tick();
  const left = field.query().bodies.map((b) => b.rect!.x).sort((a, c) => a - c);
  assert.deepEqual(left, [100, 380], 'both bodies remain exactly at their rects (no engine ownership)');
  field.destroy();
});
