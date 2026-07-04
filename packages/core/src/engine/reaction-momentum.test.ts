import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

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

// signed x-displacement of the single dynamic body's centre from its start.
function dynDx(field: ReturnType<typeof createField>, startCx: number): number {
  const b = field.query().bodies.find((x) => x.authority === 'dynamic')!;
  return b.rect!.x + b.rect!.width / 2 - startCx;
}

const streamBody = () => ({
  tokens: ['stream'] as string[], strength: 2.5, range: 500, authority: 'dynamic' as const, data: { id: 'jet' },
  rect: () => ({ left: 370, top: 270, width: 60, height: 60 }), // centre (400, 300)
});

test('reaction: a directional emitter recoils opposite its emission (rocket)', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none', density: 3, mass: true, reaction: true });
  field.addBody(streamBody()); // stream pushes matter along +x (default heading) → body recoils −x
  for (let i = 0; i < 60; i++) tick();
  const dx = dynDx(field, 400);
  assert.ok(dx < -1, `dynamic stream body recoils in −x, opposite its +x emission (dx=${dx.toFixed(2)})`);
  field.destroy?.();
});

test('reaction off ⇒ no self-recoil (byte-identical): the emitter stays put with no other bodies', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none', density: 3, mass: true }); // reaction OFF
  field.addBody(streamBody());
  for (let i = 0; i < 60; i++) tick();
  const dx = dynDx(field, 400);
  assert.ok(Math.abs(dx) < 0.5, `no reaction ⇒ the body does not recoil from its own emission (dx=${dx.toFixed(2)})`);
  field.destroy?.();
});
