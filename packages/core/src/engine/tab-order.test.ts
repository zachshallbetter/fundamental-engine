/**
 * Tab order as a field current (#943). The sequencing rule is the part worth testing hard: it is
 * fiddly, browsers implement it exactly, and getting it wrong points the cue at the wrong body with
 * nothing to say so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tabSequence, tabSuccessor, tabPredecessor, tabCurrentInto,
  TAB_CURRENT_WIDTH,
} from './tab-order.ts';

const c = (tabIndex: number, focusable = true) => ({ tabIndex, focusable });

test('positive tabindex comes first, ascending, before everything natural', () => {
  // document order: [0, 3, 0, 1, 0] → browsers visit 3 and 1 FIRST, ascending, then the zeros.
  const items = [c(0), c(3), c(0), c(1), c(0)];
  assert.deepEqual(tabSequence(items), [3, 1, 0, 2, 4]);
});

test('ties within one positive value keep document order', () => {
  const items = [c(2), c(1), c(2), c(1)];
  assert.deepEqual(tabSequence(items), [1, 3, 0, 2], 'the two 1s in order, then the two 2s in order');
});

test('tabindex="-1" is not in the sequence at all — it is programmatic focus only', () => {
  const items = [c(0), c(-1), c(0)];
  assert.deepEqual(tabSequence(items), [0, 2]);
});

test('a body with nothing focusable in it is skipped', () => {
  // a [data-hot] card whose content is plain text never receives focus, so it is not a stop.
  const items = [c(0), c(0, false), c(0)];
  assert.deepEqual(tabSequence(items), [0, 2]);
});

test('the successor does NOT wrap — the last body leads to the browser chrome, not back to the first', () => {
  const seq = tabSequence([c(0), c(0), c(0)]);
  assert.equal(tabSuccessor(seq, 0), 1);
  assert.equal(tabSuccessor(seq, 1), 2);
  assert.equal(tabSuccessor(seq, 2), -1, 'no wrap: pretending it loops points the cue somewhere Tab will not go');
  assert.equal(tabSuccessor(seq, 99), -1, 'an element outside the sequence has no successor');
});

test('the predecessor mirrors it for Shift+Tab', () => {
  const seq = tabSequence([c(0), c(0), c(0)]);
  assert.equal(tabPredecessor(seq, 2), 1);
  assert.equal(tabPredecessor(seq, 0), -1, 'the first stop has no predecessor');
});

test('the successor follows the SEQUENCE, not document order, when tabindex reorders it', () => {
  // the failure this forecloses: using array order and silently pointing at the wrong body.
  const items = [c(0), c(5), c(0)];
  const seq = tabSequence(items); // [1, 0, 2]
  assert.equal(tabSuccessor(seq, 1), 0, 'from the tabindex=5 body, Tab goes to the FIRST natural one');
  assert.equal(tabSuccessor(seq, 0), 2);
});

// ── the current ─────────────────────────────────────────────────────────────────────────────────

test('the current leans along the focused → next direction, never back', () => {
  const out = { x: 0, y: 0 };
  tabCurrentInto(out, 150, 100, 100, 100, 200, 100); // midpoint of a rightward pair
  assert.ok(out.x > 0 && Math.abs(out.y) < 1e-12, `pushes toward the next stop: ${JSON.stringify(out)}`);

  tabCurrentInto(out, 150, 100, 200, 100, 100, 100); // the same pair, reversed
  assert.ok(out.x < 0, 'and reverses when the sequence does');
});

test('it falls off across the channel and stops at its width', () => {
  const out = { x: 0, y: 0 };
  const at = (dy: number): number => {
    tabCurrentInto(out, 150, 100 + dy, 100, 100, 200, 100);
    return Math.hypot(out.x, out.y);
  };
  assert.ok(at(0) > at(40) && at(40) > at(80), `falls off across: ${at(0)} > ${at(40)} > ${at(80)}`);
  assert.equal(at(TAB_CURRENT_WIDTH), 0, 'nothing at the width');
  assert.equal(at(TAB_CURRENT_WIDTH + 50), 0, 'nothing past it');
});

test('it is a channel between two places, not an infinite line through them', () => {
  const out = { x: 0, y: 0 };
  const on = (x: number): number => {
    tabCurrentInto(out, x, 100, 100, 100, 200, 100);
    return Math.hypot(out.x, out.y);
  };
  assert.ok(on(150) > 0, 'live between the two bodies');
  assert.equal(on(400), 0, 'dead far beyond the second');
  assert.equal(on(-200), 0, 'and far before the first');
});

test('two bodies at the same point produce nothing rather than NaN', () => {
  // a zero-length segment has no direction; normalizing it would put NaN into every particle.
  const out = { x: 0, y: 0 };
  tabCurrentInto(out, 150, 100, 120, 120, 120, 120);
  assert.deepEqual(out, { x: 0, y: 0 });
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y));
});
