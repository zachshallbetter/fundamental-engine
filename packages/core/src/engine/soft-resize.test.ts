/**
 * Soft resize — a mobile browser's URL bar showing/hiding fires `resize` with a small height-only
 * change, continuously, as the page scrolls. Every resize used to rebuild the whole swarm (new
 * particles, captured matter dropped) and re-scan the DOM, so the field reset mid-scroll. A
 * height-only change within the soft band now keeps the swarm and only re-measures bodies; a width
 * change or a large height change still rebuilds. Driven headlessly through a host whose resize
 * callback the test fires by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function resizableHost(): { host: FieldHost; resize: (w: number, h: number) => void; scans: () => number } {
  let W = 400;
  let H = 800;
  let onResize: (() => void) | null = null;
  let scans = 0;
  const off = (): void => {};
  const host: FieldHost = {
    root: {
      querySelectorAll: () => {
        scans++;
        return [];
      },
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: W, height: H, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => H,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 0, // never auto-loops; the test drives resize directly
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: (cb) => {
      onResize = cb;
      return off;
    },
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  return {
    host,
    resize: (w, h) => {
      W = w;
      H = h;
      onResize?.();
    },
    scans: () => scans,
  };
}

function ids(field: ReturnType<typeof createField>): number[] {
  const out = new Uint32Array(4096);
  return [...out.subarray(0, field.readParticleIds(out))];
}

function ys(field: ReturnType<typeof createField>): number[] {
  const n = field.particleCount();
  const out = new Float32Array(n * 5);
  const w = field.readParticles(out);
  return Array.from({ length: w }, (_, i) => out[i * 5 + 1]!);
}

test('a small height-only resize (URL bar) keeps the swarm and does not re-scan the DOM', () => {
  const { host, resize, scans } = resizableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const before = ids(field);
    assert.ok(before.length > 0, 'the field seeded a swarm');
    const scansBefore = scans();

    resize(400, 744); // the URL bar collapses: 56px shorter
    assert.deepEqual(ids(field), before, 'every particle survives the resize');
    assert.equal(scans() - scansBefore, 0, 'no DOM re-scan for a soft resize');

    resize(400, 800); // and expands again
    assert.deepEqual(ids(field), before, 'still the same swarm');
  } finally {
    field.destroy();
  }
});

test('a soft shrink folds matter below the new floor back into the field', () => {
  const { host, resize } = resizableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    resize(400, 660); // 140px shorter — inside the soft band
    for (const y of ys(field)) assert.ok(y <= 660, `particle y ${y} is inside the 660px field`);
  } finally {
    field.destroy();
  }
});

test('a width change or a large height change still rebuilds the swarm', () => {
  const { host, resize, scans } = resizableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const first = ids(field);
    let s = scans();
    resize(420, 800); // width changed — rotate, window drag
    assert.notDeepEqual(ids(field), first, 'a width change rebuilds');
    assert.ok(scans() > s, 'and re-scans the DOM');

    const second = ids(field);
    s = scans();
    resize(420, 500); // 300px shorter — well outside the soft band
    assert.notDeepEqual(ids(field), second, 'a large height change rebuilds');
    assert.ok(scans() > s, 'and re-scans the DOM');
  } finally {
    field.destroy();
  }
});

test('soft resizes are measured from the built height, so they cannot creep past the band', () => {
  const { host, resize, scans } = resizableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const first = ids(field);
    resize(400, 700); // −100: soft
    assert.deepEqual(ids(field), first);
    const s = scans();
    resize(400, 600); // −200 from the built 800: rebuild, even though this step is only −100
    assert.notDeepEqual(ids(field), first, 'cumulative drift past the band rebuilds');
    assert.ok(scans() > s);
  } finally {
    field.destroy();
  }
});
