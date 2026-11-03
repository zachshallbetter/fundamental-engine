/**
 * A seeded field runs the same way twice (#1207).
 *
 * The cross-plane golden pins ONE apply of ONE force. That is the right thing for cross-plane force
 * math and it cannot catch this: the bug was in `frame()`, and it only showed over a whole run.
 *
 * `env.t` used to be `(now - t0) / 1000` with `t0 = performance.now()` captured when the field was
 * CONSTRUCTED. So the simulation clock's origin depended on how long elapsed between building a field
 * and its first frame — real wall time, leaking into the frame path. A seeded run was therefore not
 * reproducible: six identical runs in one process drifted monotonically, and three separate processes
 * disagreed in the fifth decimal. Seeding the rng hid most of it, which is why nothing noticed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { seededRng } from '../record/rng.ts';
import type { FieldHost } from './host.ts';

function harness(startMs = 0): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = startMs;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1200, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 600,
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
  return { host, step: (n) => { for (let i = 0; i < n; i++) { now += 16; cb?.(now); } } };
}

const rectAt = (cx: number, cy: number, w: number, h: number) => () => ({
  left: cx - w / 2, top: cy - h / 2, width: w, height: h,
});

/** A run whose outcome depends on the simulation clock and on body motion. */
function run(startMs = 0, constructionMs?: number): string {
  const { host, step } = harness(startMs);
  const field = createField({} as HTMLCanvasElement, {
    host,
    render: 'none',
    mass: true,
    reaction: true, // drives dynamic-body motion, which is where the drift showed
    rng: seededRng(7),
    ...(constructionMs === undefined ? {} : { now: () => constructionMs }),
  });
  field.addBody({ tokens: 'repel', strength: 2, range: 200, authority: 'dynamic', rect: rectAt(250, 300, 240, 80) });
  field.addBody({ tokens: 'repel', strength: 2, range: 200, authority: 'dynamic', rect: rectAt(950, 300, 60, 20) });
  step(300);
  const q = field.query({ include: ['bodies'] });
  // bit patterns, not ==: this is a byte-identity claim, and `0 === -0` would pass while differing.
  const out = (q.bodies as Array<{ rect?: { x: number; y: number } }>)
    .flatMap((b) => [b.rect?.x ?? 0, b.rect?.y ?? 0])
    .map((n) => {
      const buf = new DataView(new ArrayBuffer(8));
      buf.setFloat64(0, n);
      return buf.getBigUint64(0).toString(16);
    })
    .join(',');
  field.destroy();
  return out;
}

test('#1207 a seeded run reproduces exactly, however many runs precede it', () => {
  // Three consecutive runs in ONE process. Before the fix these drifted monotonically — each run
  // landing slightly further along than the last, converging rather than scattering.
  const a = run();
  const b = run();
  const c = run();
  assert.equal(a, b, 'run 2 matches run 1');
  assert.equal(b, c, 'run 3 matches run 2');
});

test('#1207 changing construction delay and timestamp origin preserves the seeded trajectory', () => {
  // Identical frame intervals, different construction-to-first-frame delays and absolute origins.
  // Comparing output bits exercises simulation behavior; merely asserting frame === 1 would pass
  // even with the original clock bug.
  const reference = run(100, 100);
  assert.equal(run(600, 100), reference, 'waiting before the first frame does not change phase');
  assert.equal(run(10_100, 10_100), reference, 'absolute host timestamp origin does not change phase');
});
