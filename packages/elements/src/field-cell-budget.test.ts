/**
 * `<field-cell>` scoped local-cell budgets + isolation (docs/engine-reference/shadow-dom.md §31.19).
 *
 * Each cell owns its own particle pool, so hard caps must be enforced *per instance*: a saturating
 * cell can neither grow past its own `max-particles` nor spill particle/frame cost into a neighbour.
 * These tests drive the element via its prototype with a stubbed `this` (the same no-DOM approach as
 * `field-root-surface.test.ts` / `option-attrs.test.ts`) — no canvas or observers needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldCell } from './field-cell.ts';

/** A tiny frame-sized `<field-cell>` stub: prototype IS the element's, so the private
 *  `buildPool` / `tick` and the budget getters run against own-property stubs. No DOM. */
type CellStub = FieldCell & {
  boxW: number;
  boxH: number;
  particles: unknown[];
  lastStepTs: number;
};
function makeCell(attrs: Record<string, string> = {}, boxW = 300, boxH = 300): CellStub {
  const map = new Map(Object.entries(attrs));
  const stub = Object.create(FieldCell.prototype) as CellStub;
  Object.assign(stub, {
    boxW,
    boxH,
    particles: [],
    lastStepTs: 0,
    ctx: {} as CanvasRenderingContext2D, // presence only; buildPool never touches it
    getAttribute: (k: string) => (map.has(k) ? map.get(k)! : null),
  });
  return stub;
}

const build = (c: CellStub): void =>
  (FieldCell.prototype as unknown as { buildPool: () => void }).buildPool.call(c);

/** Drive the private frame-budget gate directly (the same decision `tick` makes each rAF). */
const renders = (c: CellStub, now: number): boolean =>
  (FieldCell.prototype as unknown as { shouldRenderFrame: (n: number) => boolean }).shouldRenderFrame.call(
    c,
    now,
  );

/** Count how many frames a cell renders across a sequence of rAF timestamps. */
function renderedFrames(c: CellStub, timestamps: number[]): number {
  let n = 0;
  for (const t of timestamps) if (renders(c, t)) n++;
  return n;
}

// ── max-particles: the hard pool ceiling (§31.19) ─────────────────────────────

test('max-particles caps the auto-sized pool', () => {
  // A large frame auto-sizes to the 90-particle ceiling; max-particles lowers it further.
  const capped = makeCell({ 'max-particles': '12' }, 1200, 1200);
  build(capped);
  assert.equal(capped.particles.length, 12, 'auto-size is clamped to the declared budget');
});

test('max-particles caps an explicit count (budget wins over count)', () => {
  const cell = makeCell({ count: '500', 'max-particles': '30' });
  build(cell);
  assert.equal(cell.particles.length, 30, 'an over-budget count is clamped to max-particles');
});

test('max-particles never inflates a smaller pool', () => {
  const cell = makeCell({ count: '8', 'max-particles': '200' });
  build(cell);
  assert.equal(cell.particles.length, 8, 'the cap is a ceiling, not a floor');
});

test('no max-particles ⇒ unchanged auto-size behaviour (backward compatible)', () => {
  const cell = makeCell({}, 900, 900); // area/9000 = 90, clamped to the [16,90] auto range
  build(cell);
  assert.equal(cell.particles.length, 90, 'default (no cap) sizes exactly as before');
});

// ── isolation: two cells never share or starve one pool (§29 Local Cell Isolation) ──

test('two cells with different budgets get independent pools', () => {
  const small = makeCell({ 'max-particles': '10' }, 1200, 1200);
  const big = makeCell({ 'max-particles': '80' }, 1200, 1200);
  build(small);
  build(big);
  assert.equal(small.particles.length, 10);
  assert.equal(big.particles.length, 80);
  assert.notEqual(small.particles, big.particles, 'the pools are distinct objects (no sharing)');
});

test('one cell saturating its budget does not starve or resize a neighbour', () => {
  const hog = makeCell({ count: '10000', 'max-particles': '10000' }, 2000, 2000);
  const neighbour = makeCell({ count: '500', 'max-particles': '20' }, 400, 400);
  build(hog);
  build(neighbour);
  // The hog fills its own (large) budget; the neighbour is clamped to its own small cap.
  assert.equal(hog.particles.length, 10000);
  assert.equal(neighbour.particles.length, 20, 'neighbour is clamped by its own budget, not the hog');
  // Rebuilding the hog again must not touch the neighbour's pool.
  const before = neighbour.particles;
  build(hog);
  assert.equal(neighbour.particles, before, 'neighbour pool is never mutated by another cell');
});

// ── fps: the per-cell frame budget throttles the loop (§31.19) ─────────────────

test('fps throttles the loop: frames are skipped until one interval elapses', () => {
  // fps=10 ⇒ a 100ms interval. rAF timestamps are the page clock (never 0); the first frame
  // of a run always renders and starts the clock, then frames inside the window are skipped.
  const cell = makeCell({ fps: '10' });
  assert.equal(renders(cell, 1000), true, 'the first frame of a run renders and starts the clock');
  assert.equal(renders(cell, 1050), false, '+50ms is within the 100ms budget window — skipped');
  assert.equal(renders(cell, 1100), true, '+100ms crosses the interval — renders');
  assert.equal(renders(cell, 1130), false, 'within the next window — skipped');
  assert.equal(renders(cell, 1200), true, 'crosses again — renders');
});

test('the first frame after a resume is never stalled by the budget', () => {
  // start() zeroes lastStepTs on resume; the first frame back must render immediately.
  const cell = makeCell({ fps: '5' }); // a 200ms interval
  cell.lastStepTs = 0;
  assert.equal(renders(cell, 5000), true, 'resumed cell renders at once, not after 200ms');
});

test('no fps ⇒ every frame renders (unchanged native cadence, backward compatible)', () => {
  const cell = makeCell({}); // no fps attribute
  assert.equal(renderedFrames(cell, [1000, 1001, 1002, 1003, 1004]), 5, 'no budget ⇒ every frame renders');
});

test('two cells hold independent fps budgets', () => {
  const fast = makeCell({ fps: '60' }); // ~16.7ms interval
  const slow = makeCell({ fps: '5' }); // 200ms interval
  const timeline = [1000, 1020, 1040, 1060, 1080, 1100, 1120, 1140, 1160, 1180, 1200];
  const fastFrames = renderedFrames(fast, timeline);
  const slowFrames = renderedFrames(slow, timeline);
  // Over the 200ms span the fast cell renders many frames; the slow cell renders far fewer.
  assert.ok(fastFrames > slowFrames, `fast (${fastFrames}) outpaces slow (${slowFrames})`);
  assert.ok(slowFrames <= 2, 'a 5fps cell renders at most ~1 frame per 200ms window');
});

// ── observed attributes: the budget knobs are reflected ───────────────────────

test('max-particles and fps are observed attributes (live changes take effect)', () => {
  const observed = new Set(FieldCell.observedAttributes);
  assert.ok(observed.has('max-particles'), 'max-particles is observed');
  assert.ok(observed.has('fps'), 'fps is observed');
});
