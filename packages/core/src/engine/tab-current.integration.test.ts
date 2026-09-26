/**
 * The tab-order current on a live field (#943) — the half the pure tests cannot reach: that focus
 * actually resolves a successor, that the channel is written to exactly one body and REMOVED when
 * it stops being that body, and that a reduced-motion field keeps the cue while moving nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { seededRng } from '../record/rng.ts';
import type { FieldHost } from './host.ts';

const MS = 1000 / 60;

/** A `[data-hot]` body with a focusable child, whose CSS writes we can read back. */
function hotBody(x: number, y: number, opts: { tabIndex?: number; focusable?: boolean; childTabIndex?: number } = {}) {
  const props: Record<string, string> = {};
  const listeners: Record<string, (() => void)[]> = {};
  const el = {
    props,
    dataset: { hot: '', body: 'attract', strength: '1', range: '300', feedback: '' } as Record<string, string>,
    // a real [data-hot] container is a <div>: tabIndex -1. It becomes a Tab stop because it
    // CONTAINS something focusable, which is the rule the sequencer has to get right.
    tabIndex: opts.tabIndex ?? -1,
    isConnected: true,
    getAttribute: (n: string) => (n === 'data-body' ? 'attract' : n === 'data-strength' ? '1' : n === 'data-range' ? '300' : n === 'data-feedback' ? '' : n === 'data-hot' ? '' : null),
    hasAttribute: (n: string) => ['data-body', 'data-strength', 'data-range', 'data-feedback', 'data-hot'].includes(n),
    setAttribute: () => {},
    removeAttribute: () => {},
    dispatchEvent: () => true,
    closest: () => null,
    // a real focusable child — an <a href> reports tabIndex 0, which is what puts the CARD in
    // the natural tab order even though the card itself is tabIndex -1.
    // Answer ONLY the focusable-descendant query. An earlier draft returned the same stub for every
    // selector, so the scanner's own queries (shadow rect providers and the like) got a bogus hit and
    // the two runs differed by ~284px of geometry — a harness bug that read exactly like an engine one.
    querySelector: (sel: string) =>
      sel.includes('a[href]') && (opts.focusable ?? true)
        ? ({ tabIndex: opts.childTabIndex ?? 0 } as unknown as Element)
        : null,
    querySelectorAll: () => [],
    addEventListener: (t: string, fn: () => void) => void ((listeners[t] ??= []).push(fn)),
    removeEventListener: () => {},
    fire: (t: string) => listeners[t]?.forEach((f) => f()),
    style: {
      setProperty: (n: string, v: string) => void (props[n] = v),
      removeProperty: (n: string) => void delete props[n],
      getPropertyValue: (n: string) => props[n] ?? '',
    },
    getBoundingClientRect: () => ({ left: x - 20, top: y - 20, right: x + 20, bottom: y + 20, width: 40, height: 40, x: x - 20, y: y - 20, toJSON: () => ({}) }),
  };
  return el;
}

function host(els: unknown[], opts: { reducedMotion?: boolean } = {}): { host: FieldHost; step: (n: number) => void; thaw: () => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let now = 0;
  let frozen = opts.reducedMotion ?? false;
  const h: FieldHost = {
    root: {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') || sel.startsWith('[data-hot]') ? els : []),
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => frozen,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return 1; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  return { host: h, step: (n) => { for (let i = 0; i < n; i++) { now += MS; cb?.(now); } }, thaw: () => void (frozen = false) };
}

const nextVar = (el: ReturnType<typeof hotBody>): string => el.props['--field-next'] ?? '';

test('focus marks the NEXT body, not the focused one', () => {
  const a = hotBody(200, 300);
  const b = hotBody(500, 300);
  const c = hotBody(800, 300);
  const { host: h, step } = host([a, b, c]);
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    step(8);
    assert.equal(nextVar(b), '', 'nothing is marked before anything has focus');

    a.fire('focusin');
    step(8);
    assert.equal(nextVar(b), '1.000', 'focusing the first body marks the SECOND');
    assert.equal(nextVar(a), '', 'and not the focused one itself');
    assert.equal(nextVar(c), '', 'nor any other');

    b.fire('focusin');
    step(8);
    assert.equal(nextVar(c), '1.000', 'focus advances, and so does the cue');
    assert.equal(nextVar(b), '', 'the old successor is CLEARED, not left marked');
  } finally {
    field.destroy();
  }
});

test('the last body has no successor — the cue does not wrap round to the first', () => {
  const a = hotBody(200, 300);
  const b = hotBody(500, 300);
  const { host: h, step } = host([a, b]);
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    b.fire('focusin');
    step(8);
    assert.equal(nextVar(a), '', 'Tab from the last body goes to the browser chrome, not back to the first');
    assert.equal(nextVar(b), '');
  } finally {
    field.destroy();
  }
});

test('the property is REMOVED when focus leaves, not left at 0', () => {
  // an author selecting on `[style*="--field-next"]` wants it absent, not "0.000".
  const a = hotBody(200, 300);
  const b = hotBody(500, 300);
  const { host: h, step } = host([a, b]);
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    a.fire('focusin');
    step(8);
    assert.equal(nextVar(b), '1.000');
    a.fire('focusout');
    step(8);
    assert.equal(Object.prototype.hasOwnProperty.call(b.props, '--field-next'), false, 'removed, not zeroed');
  } finally {
    field.destroy();
  }
});

test('tabindex reorders the cue — it follows the tab SEQUENCE, not document order', () => {
  const a = hotBody(200, 300);                       // natural
  const b = hotBody(500, 300, { tabIndex: 5 });      // visited FIRST
  const c = hotBody(800, 300);                       // natural
  const { host: h, step } = host([a, b, c]);
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    b.fire('focusin'); // from the tabindex=5 body, Tab goes to the first NATURAL one
    step(8);
    assert.equal(nextVar(a), '1.000', 'the cue follows the real tab order');
    assert.equal(nextVar(c), '', 'not the next one in document order');
  } finally {
    field.destroy();
  }
});

test('a body with nothing focusable inside is not a stop', () => {
  const a = hotBody(200, 300);
  const dead = hotBody(500, 300, { focusable: false });
  const c = hotBody(800, 300);
  const { host: h, step } = host([a, dead, c]);
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    a.fire('focusin');
    step(8);
    assert.equal(nextVar(c), '1.000', 'Tab skips the unfocusable body');
    assert.equal(nextVar(dead), '', 'which is therefore never marked');
  } finally {
    field.destroy();
  }
});

test('reduced motion keeps the cue and moves nothing — the static equivalent', () => {
  // The governance contract: a motion projection needs a static equivalent. The channel IS it, and
  // the current must contribute exactly zero on a frozen field.
  const a = hotBody(200, 300);
  const b = hotBody(500, 300);
  const { host: h, step } = host([a, b], { reducedMotion: true });
  const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(3) });
  try {
    field.scan();
    const before = new Float32Array(5 * 600);
    field.readParticles(before);
    a.fire('focusin');
    step(30);
    assert.equal(nextVar(b), '1.000', 'the cue is still there — it is a value, not a movement');
    const after = new Float32Array(5 * 600);
    field.readParticles(after);
    assert.deepEqual([...after], [...before], 'and nothing moved at all');
  } finally {
    field.destroy();
  }
});

// NOT TESTED, and deliberately recorded rather than buried: that the current banks no LATENT
// velocity while the field is frozen. The guard is one line (`if (env.dt && tabFocused && tabNext)`)
// and removing it does NOT turn this suite red — `readParticles` carries no velocity lane, so the
// only observable is the first thawed frame, and four attempts to isolate it all failed on real
// confounds: engagement eases `--d` across the frozen frames and changes that frame's forces by
// itself, whichever way the comparison is arranged. The property is argued from the guard, not
// proved by a test. A velocity lane on `readParticles`, or a `snapshot()` that carried velocity,
// would make it provable.

test('on a MOVING field the current steers matter toward the successor — direction isolated', () => {
  // The obvious version of this test is CONFOUNDED and I wrote it first: `focusin` also ENGAGES the
  // body (#942), and an engaged `attract` pulls matter toward itself far harder than this current
  // pushes it along. Comparing focused-vs-unfocused measured engagement, not the current, and came
  // out backwards (462.7 vs 553.9).
  //
  // So hold everything constant — the same three bodies, the same body focused, the same engagement
  // — and vary only WHERE the successor is. `b` sits to the right, `c` above it. When `b` is a Tab
  // stop the current runs a→b; when `b` is skipped it runs a→c instead. Only the direction differs,
  // so only the current can move the result.
  const run = (bIsAStop: boolean): number => {
    const a = hotBody(200, 300);
    const b = hotBody(600, 300, { focusable: bIsAStop });
    const c = hotBody(600, 80);
    const { host: h, step } = host([a, b, c]);
    const field = createField({} as HTMLCanvasElement, { host: h, render: 'none', rng: seededRng(11), now: () => 0 });
    try {
      field.scan();
      a.fire('focusin');
      step(40);
      const out = new Float32Array(5 * 600);
      field.readParticles(out);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < out.length; i += 5) {
        const x = out[i]!;
        const y = out[i + 1]!;
        if (x === 0 && y === 0) continue;
        if (x > 250 && x < 650) { sum += y; n++; } // mean HEIGHT of the matter between the bodies
      }
      return n ? sum / n : 0;
    } finally {
      field.destroy();
    }
  };
  const towardB = run(true);   // current runs a → b, level
  const towardC = run(false);  // current runs a → c, upward
  assert.ok(towardB > 0 && towardC > 0, 'both runs found matter between the bodies');
  assert.ok(
    towardC < towardB,
    `steering at the upper successor lifts the matter: mean y ${towardC.toFixed(2)} (→c) vs ${towardB.toFixed(2)} (→b)`,
  );
});
