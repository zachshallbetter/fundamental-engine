/**
 * `FieldHandle.addBody(spec)` — programmatic bodies (no DOM). Pins: a moved attract well pulls the
 * swarm (sample() reads a force toward it); the body carries a data record and gets per-body
 * feedback; it survives a rescan; and remove() takes it back out (no force after).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function drivableHost(): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const step = (frames: number): void => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } };
  return { host, step };
}

const rectAt = (x: number, y: number) => () => ({ left: x - 20, top: y - 20, width: 40, height: 40 });

test('addBody: a programmatic attract well pulls matter, carries data, and removes cleanly', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan(); // no DOM bodies
    const well = field.addBody({
      tokens: 'attract',
      strength: 2.4,
      range: 900,
      rect: rectAt(500, 400),
      data: { kind: 'bloom', id: 7 },
    });
    // the carried record is on the handle
    assert.deepEqual(well.data, { kind: 'bloom', id: 7 }, 'the body carries its data record');

    // the field now exerts a force toward the well: sampling to its right points left (−x).
    const f = field.sample(560, 400);
    assert.ok(f.x < 0, `the programmatic well pulls matter toward it (−x): ${f.x.toExponential(2)}`);

    // it survives a rescan (programmatic bodies aren't discoverable by the DOM scan)
    field.rescan();
    const f2 = field.sample(560, 400);
    assert.ok(f2.x < 0, `still pulling after rescan: ${f2.x.toExponential(2)}`);

    // remove() takes it back out — no force from it after
    well.remove();
    field.rescan();
    const f3 = field.sample(560, 400);
    assert.ok(Math.abs(f3.x) < Math.abs(f.x) / 4, `force collapses after remove: ${f3.x.toExponential(2)}`);
  } finally {
    field.destroy();
  }
});

test('addBody: per-body feedback delivers this body density on its own callback', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    let got: { density?: number } | null = null;
    const well = field.addBody({
      tokens: 'attract',
      strength: 2.4,
      range: 900,
      rect: rectAt(500, 400),
      onFeedback: (ch) => { got = ch; },
    });
    step(120); // gather matter at the well so its density channel rises
    assert.ok(got !== null, 'onFeedback fired for the programmatic body');
    assert.ok(typeof well.channels.density === 'number', 'the handle exposes live channels');
    assert.ok((well.channels.density ?? 0) > 0, `the well reads some gathered density: ${well.channels.density}`);
  } finally {
    field.destroy();
  }
});

test('body.set: a live strength change takes effect on the measure cadence, no rescan', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const well = field.addBody({ tokens: 'attract', strength: 0.5, range: 900, rect: rectAt(500, 400) });
    step(12);
    const weak = field.sample(560, 400);
    well.set({ strength: 4 }); // mutate live — no remove + re-add, no rescan
    step(12); // the measure cadence re-reads data-strength
    const strong = field.sample(560, 400);
    assert.ok(
      Math.abs(strong.x) > Math.abs(weak.x) * 1.5,
      `pull strengthens after set(): ${weak.x.toExponential(2)} -> ${strong.x.toExponential(2)}`,
    );
  } finally {
    field.destroy();
  }
});

test('addField: a registered channel is sampled back; set() swaps it, remove() clears it', () => {
  const { host } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const moisture = field.addField('moisture', (x, y) => x * 0.01 + y);
    assert.equal(field.sampleField('moisture', 100, 5), 6, 'samples the registered channel');
    assert.equal(field.sampleField('unknown', 1, 1), 0, 'unknown channel reads 0');
    moisture.set(() => 42); // swap the sampler live
    assert.equal(field.sampleField('moisture', 0, 0), 42, 'set() swaps the sampler');
    moisture.remove();
    assert.equal(field.sampleField('moisture', 0, 0), 0, 'remove() unregisters the channel');
  } finally {
    field.destroy();
  }
});
