import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { parseBodyParams } from './scanner.ts';
import type { FieldHost } from './host.ts';

// A BodyAttrs view over a plain map (mirrors the element/preset attr readers).
const attrs = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null, has: (n: string) => n in m });

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

test('authority: data-authority parses anchored (default) / kinematic / dynamic', () => {
  assert.equal(parseBodyParams(attrs({ body: 'attract' })).authority, 'anchored', 'absent ⇒ anchored');
  assert.equal(parseBodyParams(attrs({ body: 'attract', authority: 'kinematic' })).authority, 'kinematic');
  assert.equal(parseBodyParams(attrs({ body: 'attract', authority: 'dynamic' })).authority, 'dynamic');
  assert.equal(parseBodyParams(attrs({ body: 'attract', authority: 'bogus' })).authority, 'anchored', 'invalid ⇒ anchored');
});

test('authority: addBody declares it; query + snapshot report it (default anchored)', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], authority: 'dynamic', rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  field.addBody({ tokens: ['attract'], rect: () => ({ left: 40, top: 50, width: 20, height: 20 }) }); // default
  for (let i = 0; i < 5; i++) tick();

  const q = field.query();
  const auths = q.bodies.map((b) => b.authority).sort();
  assert.deepEqual(auths, ['anchored', 'dynamic'], 'query reports each body authority (default anchored)');

  const snap = field.snapshot();
  assert.ok(snap.bodies.every((b) => b.authority === 'anchored' || b.authority === 'dynamic'));
  assert.ok(snap.bodies.some((b) => b.authority === 'dynamic'), 'snapshot carries the declared authority');
  field.destroy();
});

test('authority: declaration is behavior-preserving — a dynamic body still measures from its rect (Step 4)', () => {
  // Step 4 is the declaration only; dynamic physics (engine-owned position) lands in Step 5. A dynamic
  // body is still anchored to its rect for now, so its reported rect matches the provided geometry.
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], authority: 'dynamic', rect: () => ({ left: 100, top: 100, width: 20, height: 20 }) });
  for (let i = 0; i < 5; i++) tick();
  const b = field.query().bodies[0]!;
  assert.ok(b.rect && Math.abs(b.rect.x - 100) < 1e-6 && Math.abs(b.rect.y - 100) < 1e-6, 'still measured from the DOM/host rect');
  field.destroy();
});
