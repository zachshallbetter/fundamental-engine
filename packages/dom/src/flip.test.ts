/**
 * withFlip tests. Same fake-element pattern as platform.test.ts — EventTarget-backed fakes with a
 * recorded style and a programmable rect, so the measure→mutate→invert→release sequence is
 * verified without a real DOM. The reduced-motion flag is set via `setEnvOverrides` (the env
 * module's test seam); requestAnimationFrame is stubbed per test (rAF runs synchronously) and
 * restored afterward.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFlip } from './flip.ts';
import { setEnvOverrides, clearEnvOverrides } from './env.ts';

interface FakeEl extends HTMLElement {
  rect: { top: number; left: number };
  props: Record<string, string>;
  /** every style op, in order: ['set', prop, value] | ['remove', prop] */
  log: string[][];
}

function fakeEl(top: number, left = 0): FakeEl {
  const el = new EventTarget() as unknown as FakeEl;
  el.rect = { top, left };
  el.log = [];
  const props: Record<string, string> = {};
  el.props = props;
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ top: el.rect.top, left: el.rect.left, width: 100, height: 20, right: el.rect.left + 100, bottom: el.rect.top + 20, x: el.rect.left, y: el.rect.top }) as DOMRect;
  (el as unknown as { style: { setProperty: (k: string, v: string) => void; removeProperty: (k: string) => void } }).style = {
    setProperty: (k: string, v: string) => {
      props[k] = v;
      el.log.push(['set', k, v]);
    },
    removeProperty: (k: string) => {
      delete props[k];
      el.log.push(['remove', k]);
    },
  };
  return el;
}

/** Stub requestAnimationFrame (runs synchronously) + set the reduced-motion override for the
 * duration of `fn`, then restore both. */
function withStubs(reduce: boolean, fn: () => void): void {
  const g = globalThis as Record<string, unknown>;
  const hadRaf = 'requestAnimationFrame' in g;
  const prevRaf = g.requestAnimationFrame;
  setEnvOverrides({ reducedMotion: reduce });
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    cb(0);
    return 0;
  };
  try {
    fn();
  } finally {
    clearEnvOverrides();
    if (hadRaf) g.requestAnimationFrame = prevRaf;
    else delete g.requestAnimationFrame;
  }
}

const sets = (el: FakeEl, prop: string): string[][] => el.log.filter((op) => op[1] === prop);

test('withFlip runs mutate, inverts a moved element, and releases the transform', () => {
  withStubs(false, () => {
    const moved = fakeEl(0);
    const still = fakeEl(40);
    let mutated = false;
    withFlip(
      () => [moved, still],
      () => {
        mutated = true;
        moved.rect.top = 40; // the mutation relocated it 40px down
      },
    );
    assert.ok(mutated, 'mutate ran');
    // invert: translated back over its old box, transition suppressed
    assert.deepEqual(sets(moved, 'transform')[0], ['set', 'transform', 'translate(0px, -40px)']);
    assert.deepEqual(sets(moved, 'transition')[0], ['set', 'transition', 'none']);
    // play (the stub rAF is synchronous): transition applied, transform released
    assert.deepEqual(sets(moved, 'transition')[1], [
      'set',
      'transition',
      'transform 500ms cubic-bezier(.2, .7, .2, 1)',
    ]);
    assert.deepEqual(sets(moved, 'transform')[1], ['remove', 'transform']);
    assert.equal(moved.props['transform'], undefined, 'transform released');
    assert.equal(
      moved.props['transition'],
      'transform 500ms cubic-bezier(.2, .7, .2, 1)',
      'inline transition still on until transitionend',
    );
    moved.dispatchEvent(new Event('transitionend'));
    assert.equal(moved.props['transition'], undefined, 'inline transition removed on settle');
    // the unmoved element is untouched
    assert.deepEqual(still.log, [], 'unmoved element gets no style ops');
  });
});

test('withFlip honors duration/easing and axis: "y" drops the horizontal delta', () => {
  withStubs(false, () => {
    const el = fakeEl(0, 0);
    withFlip(
      () => [el],
      () => {
        el.rect.top = 24;
        el.rect.left = 300; // a 1D caller treats horizontal movement as noise
      },
      { axis: 'y', duration: 400, easing: 'ease-out' },
    );
    assert.deepEqual(sets(el, 'transform')[0], ['set', 'transform', 'translateY(-24px)']);
    assert.deepEqual(sets(el, 'transition')[1], ['set', 'transition', 'transform 400ms ease-out']);
  });
});

test('withFlip skips excluded elements and elements that appear only after mutate', () => {
  withStubs(false, () => {
    const retiered = fakeEl(0);
    const fresh = fakeEl(80); // not in the first measurement — revealed by the mutation
    const els: FakeEl[] = [retiered];
    withFlip(
      () => els,
      () => {
        retiered.rect.top = 60;
        fresh.rect.top = 100;
        els.push(fresh);
      },
      { exclude: (el) => el === (retiered as unknown as HTMLElement) },
    );
    assert.deepEqual(retiered.log, [], 'excluded element left for the caller to settle');
    assert.deepEqual(fresh.log, [], 'no first rect — left alone');
  });
});

test('withFlip under prefers-reduced-motion: mutate runs, zero transforms', () => {
  withStubs(true, () => {
    const el = fakeEl(0);
    let mutated = false;
    withFlip(
      () => [el],
      () => {
        mutated = true;
        el.rect.top = 40;
      },
    );
    assert.ok(mutated, 'mutate still runs');
    assert.deepEqual(el.log, [], 'no style ops at all');
  });
});
