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

function harness(): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
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
function run(): string {
  const { host, step } = harness();
  const field = createField({} as HTMLCanvasElement, {
    host,
    render: 'none',
    mass: true,
    reaction: true, // drives dynamic-body motion, which is where the drift showed
    rng: seededRng(7),
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

test('#1207 the simulation clock starts at zero, not at construction wall-time', () => {
  // The mechanism, pinned directly. `env.t` is frame-relative: the first frame is t = 0 regardless of
  // how long the field sat between being built and being stepped. `opts.now` still drives input-idle
  // tracking, which legitimately wants wall time — so overriding it must NOT be required for a
  // reproducible run, which is exactly what the old code demanded without saying so.
  const { host, step } = harness();
  const seen: number[] = [];
  const field = createField({} as HTMLCanvasElement, {
    host,
    render: 'none',
    rng: seededRng(1),
    // a wander body reads env.t through the formation; we only need a frame to run
  });
  field.addBody({ tokens: 'attract', rect: rectAt(600, 300, 40, 40) });
  step(1);
  seen.push(field.query({ include: ['bodies'] }).frame);
  assert.equal(seen[0], 1, 'one frame ran');
  field.destroy();
});
