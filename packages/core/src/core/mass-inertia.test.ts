import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

// headless host; hand-pumped frames (mirrors dynamic-bodies.test.ts).
function tickHost(width = 800, height = 600): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root, viewport: () => ({ width, height, dpr: 1 }), scrollY: () => 0, scrollHeight: () => height,
    reducedMotion: () => false, hidden: () => false,
    raf: (cb) => { frame = cb; return 1; }, cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {}, onScroll: () => () => {}, onVisibility: () => () => {}, onInput: () => () => {}, onBodyEvent: () => () => {},
  };
  return { host, tick: (at) => { t = at ?? t + 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

const dyn = (id: string, left: number, w: number, h: number) => ({
  tokens: ['charge'] as string[], strength: 0.5, range: 120, authority: 'dynamic' as const, data: { id },
  rect: () => ({ left, top: 280, width: w, height: h }),
});

test('mass: a dynamic body has NO inertia by default — byte-identical (b.inertia undefined)', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none' }); // mass off
  field.addBody({ tokens: ['attract'], strength: 3, range: 600, rect: () => ({ left: 380, top: 280, width: 40, height: 40 }) });
  field.addBody(dyn('mote', 100, 40, 40));
  for (let i = 0; i < 20; i++) tick();
  const b = field.query().bodies.find((x) => x.authority === 'dynamic')!;
  // no first-class mass ⇒ the reading carries no inertial mass (recoil used source M, as before)
  assert.equal((b as { inertia?: number }).inertia, undefined, 'inertia stays undefined when mass is off');
});

test('mass: under first-class mass, a big body recoils LESS than a small one (inertia ∝ area)', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none', mass: true });
  // one strong anchored attractor pulling both motes toward centre.
  field.addBody({ tokens: ['attract'], strength: 4, range: 800, rect: () => ({ left: 380, top: 280, width: 40, height: 40 }) });
  const smallStart = 120, bigStart = 640;
  field.addBody({ ...dyn('small', smallStart, 40, 20) });      // ~800 px² → light
  field.addBody({ ...dyn('big', bigStart, 420, 90) });         // ~37800 px² → heavy
  for (let i = 0; i < 40; i++) tick();
  const bodies = field.query().bodies.filter((x) => x.authority === 'dynamic');
  const small = bodies.find((x) => Math.abs((x.rect?.x ?? 0) - 0) < 400 && (x.rect?.width ?? 0) < 100)!;
  const big = bodies.find((x) => (x.rect?.width ?? 0) > 100)!;
  const smallMoved = Math.abs((small.rect!.x + small.rect!.width / 2) - (smallStart + 20));
  const bigMoved = Math.abs((big.rect!.x + big.rect!.width / 2) - (bigStart + 210));
  assert.ok(smallMoved > 0, 'the light body actually recoils');
  assert.ok(smallMoved > bigMoved * 1.5, `light moves markedly more than heavy (small=${smallMoved.toFixed(1)} big=${bigMoved.toFixed(1)})`);
});
