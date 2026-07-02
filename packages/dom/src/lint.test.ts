/**
 * Platform lint tests. Each rule is pure over the registries / DOM, so they run against tiny stubs
 * (the same fake-element pattern as platform.test.ts) — no real page needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeasurementRegistry } from './measurement.ts';
import { StateRegistry } from './state.ts';
import { FeedbackRegistry } from './feedback.ts';
import { OverlayRegistry } from './overlays.ts';
import { RelationshipRegistry } from './relationships.ts';
import { FrameScheduler } from './schedule.ts';
import { createFieldPlatform } from './platform.ts';
import {
  lintRelationTargets,
  lintCompositingPerf,
  lintStateRegistration,
  lintOverlayLinks,
  lintFeedbackVars,
  lintSinkFeedback,
  lintFeedbackVarReads,
  lintFeedbackWritesUnread,
  lintFeedbackReadsUnwritten,
  lintInertFeedback,
  lintFeedbackNeverWritten,
  FEEDBACK_NEVER_WRITTEN_FRAMES,
  lintSchedulerViolations,
  lintReducedMotion,
  lintPlatform,
} from './lint.ts';

/** A fake FeedbackRegistry exposing just the boundVars() the inert-lane rule reads. */
function fakeFeedback(entries: Array<{ element: Element; vars: string[] }>): FeedbackRegistry {
  return { boundVars: () => entries } as unknown as FeedbackRegistry;
}

test('lintInertFeedback flags a designed lane neither computed nor supplied (the nav-sweep gap)', () => {
  // navigation-current declares memory (computed) + signal/route-strength (designed, unsupplied)
  const el = { getAttribute: () => null, hasAttribute: () => false } as unknown as Element;
  const w = lintInertFeedback(
    fakeFeedback([{ element: el, vars: ['--field-memory', '--field-signal', '--field-route-strength'] }]),
  );
  assert.equal(w.length, 2);
  assert.ok(w.every((x) => x.code === 'feedback-lane-inert'));
});

test('lintInertFeedback stays quiet when the lane is computed, supplied, or not a --field- lane', () => {
  const computed = { getAttribute: () => null, hasAttribute: () => false } as unknown as Element;
  assert.deepEqual(
    lintInertFeedback(fakeFeedback([{ element: computed, vars: ['--field-attention', '--field-memory', '--field-priority'] }])),
    [],
  );
  // host grounds the designed lane → fine
  const supplied = { getAttribute: () => '0.5', hasAttribute: (n: string) => n === 'data-field-signal' } as unknown as Element;
  assert.deepEqual(lintInertFeedback(fakeFeedback([{ element: supplied, vars: ['--field-signal'] }])), []);
  // non --field- channels (--d, --load) are out of scope
  assert.deepEqual(lintInertFeedback(fakeFeedback([{ element: computed, vars: ['--d', '--load'] }])), []);
});

test('lintFeedbackNeverWritten flags a bound body that never received a non-zero value after N frames', () => {
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  const inert = mkFeedbackEl();
  const live = mkFeedbackEl();
  feedback.bind(inert, { density: '--field-density' });
  feedback.bind(live, { density: '--field-density' });
  state.set(live, 'density', 0.4); // live body receives a value; inert never does
  for (let i = 0; i < FEEDBACK_NEVER_WRITTEN_FRAMES; i++) feedback.flush(state);
  const w = lintFeedbackNeverWritten(feedback);
  assert.equal(w.length, 1, 'only the never-written body is flagged');
  assert.equal(w[0]!.code, 'feedback-never-written');
  assert.equal(w[0]!.element, inert);
});

test('lintFeedbackNeverWritten stays quiet while a body is still warming up (under the frame threshold)', () => {
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  const el = mkFeedbackEl();
  feedback.bind(el, { density: '--field-density' });
  for (let i = 0; i < FEEDBACK_NEVER_WRITTEN_FRAMES - 1; i++) feedback.flush(state);
  assert.deepEqual(lintFeedbackNeverWritten(feedback), [], 'below threshold → still warming up, not flagged');
});

test('lintFeedbackNeverWritten treats a zero value as "never written" (zero is no reaction)', () => {
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  const el = mkFeedbackEl();
  feedback.bind(el, { density: '--field-density' });
  state.set(el, 'density', 0); // a zero is written but means "at rest" — does not count as reacting
  for (let i = 0; i < FEEDBACK_NEVER_WRITTEN_FRAMES; i++) feedback.flush(state);
  const w = lintFeedbackNeverWritten(feedback);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'feedback-never-written');
});

/** A connected element exposing the style.setProperty + isConnected a real FeedbackRegistry.flush() needs. */
function mkFeedbackEl(): Element {
  const el = { isConnected: true, style: { setProperty: () => {} } } as unknown as Element;
  return el;
}

function fakeEl(connected = true): Element {
  const el = new EventTarget() as unknown as Element & { isConnected: boolean };
  el.isConnected = connected;
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1, x: 0, y: 0 }) as DOMRect;
  (el as unknown as { style: { setProperty: () => void } }).style = { setProperty: () => {} };
  return el;
}

test('lintRelationTargets flags missing target attr and unresolvable targets, passes good ones', () => {
  const relEl = (rel: string, target: string | null): Element =>
    ({ getAttribute: (n: string) => (n === 'data-field-relation' ? rel : n === 'data-field-target' ? target : null) }) as unknown as Element;
  const els = [relEl('references', '#ok'), relEl('references', '#gone'), relEl('controls', null)];
  const root = { querySelectorAll: () => els } as unknown as ParentNode;
  const resolve = (id: string) => (id === 'ok' ? ({} as Element) : null);
  const w = lintRelationTargets(root, resolve);
  assert.equal(w.length, 2);
  assert.ok(w.some((x) => x.message.includes('resolves to no element')));
  assert.ok(w.some((x) => x.message.includes('no data-field-target')));
  assert.ok(w.every((x) => x.code === 'relation-target-missing'));
});

/** A fake declarative element: getAttribute/hasAttribute over a plain attribute map. */
function attrEl(attrs: Record<string, string>): Element {
  return {
    getAttribute: (n: string) => (n in attrs ? attrs[n]! : null),
    hasAttribute: (n: string) => n in attrs,
  } as unknown as Element;
}

/** A fake subtree whose querySelectorAll answers the two attribute selectors the rules use. */
function attrRoot(els: Element[]): ParentNode {
  return {
    querySelectorAll: (sel: string) => {
      const names = [...sel.matchAll(/\[([a-z-]+)\]/g)].map((m) => m[1]!);
      return els.filter((el) => names.some((n) => el.hasAttribute(n)));
    },
  } as unknown as ParentNode;
}

test('lintSinkFeedback flags a capturing sink with no data-feedback (the shipped vessel bug)', () => {
  // the historical shape: #bim-core captured matter for months but, without data-feedback,
  // the engine never wrote --load back — the meter sat empty and nobody saw a thing.
  const broken = attrEl({ 'data-body': 'sink attract', 'data-absorb': '74', 'data-max': '10' });
  const w = lintSinkFeedback(attrRoot([broken]));
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'sink-without-feedback');
  assert.equal(w[0]!.element, broken);
  assert.match(w[0]!.message, /--load/);
});

test('lintSinkFeedback stays quiet on the correct shape and on non-sink bodies', () => {
  const correct = attrEl({ 'data-body': 'sink', 'data-absorb': '', 'data-max': '8', 'data-feedback': '' });
  const notASink = attrEl({ 'data-body': 'attract', 'data-max': '8' });
  const plainSink = attrEl({ 'data-body': 'sink' }); // no absorb/max → nothing to capture
  assert.deepEqual(lintSinkFeedback(attrRoot([correct, notASink, plainSink])), []);
});

test('lintFeedbackVarReads flags a body styled from channels it never opted into', () => {
  // the historical shape: an element reads var(--load) in its inline style but carries
  // data-body without data-feedback — the variable is never written for it.
  const broken = attrEl({ 'data-body': 'sink', 'data-absorb': '', style: 'width: calc(var(--load, 0) * 100%)' });
  const w = lintFeedbackVarReads(attrRoot([broken]));
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'feedback-vars-unwritten');
  assert.equal(w[0]!.element, broken);
  assert.match(w[0]!.message, /var\(--load/);
  // the other two channel families lint the same way
  for (const style of ['opacity: var(--d, 0)', 'scale: var(--field-attention, 1)']) {
    assert.equal(lintFeedbackVarReads(attrRoot([attrEl({ 'data-body': 'attract', style })])).length, 1);
  }
});

test('lintFeedbackVarReads stays quiet when data-feedback is present or no channel is read', () => {
  const correct = attrEl({ 'data-body': 'sink', 'data-feedback': '', style: 'width: calc(var(--load, 0) * 100%)' });
  const noRead = attrEl({ 'data-body': 'attract', style: '--cc: #4da3ff; left: 50%' });
  const noStyle = attrEl({ 'data-body': 'attract' });
  assert.deepEqual(lintFeedbackVarReads(attrRoot([correct, noRead, noStyle])), []);
});

test('lintPlatform surfaces the declarative feedback rules through opts.root', () => {
  const el = fakeEl();
  const platform = createFieldPlatform(el);
  const root = attrRoot([
    attrEl({ 'data-body': 'sink', 'data-absorb': '' }),
    attrEl({ 'data-body': 'attract', style: 'opacity: var(--d, 0)' }),
  ]);
  const codes = lintPlatform(platform, { root }).map((w) => w.code);
  assert.ok(codes.includes('sink-without-feedback'));
  assert.ok(codes.includes('feedback-vars-unwritten'));
});

test('lintStateRegistration flags state on unregistered elements only', () => {
  const measure = new MeasurementRegistry();
  const state = new StateRegistry();
  const registered = fakeEl();
  const orphan = fakeEl();
  measure.register(registered);
  state.set(registered, 'attention', 0.5);
  state.set(orphan, 'attention', 0.9);
  const w = lintStateRegistration(state, measure);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.element, orphan);
  assert.equal(w[0]!.code, 'state-unregistered');
});

test('lintOverlayLinks flags a relationship overlay with no relationships', () => {
  const overlays = new OverlayRegistry();
  const rels = new RelationshipRegistry();
  overlays.add({ type: 'relationship', sourceElements: [fakeEl(), fakeEl()] });
  assert.equal(lintOverlayLinks(overlays, rels).length, 1);
  // once a relationship exists, the warning clears
  rels.add({ from: fakeEl(), to: fakeEl(), type: 'references', strength: 0.5, source: 'runtime' });
  assert.equal(lintOverlayLinks(overlays, rels).length, 0);
});

test('lintFeedbackVars errors on bindings that are not CSS custom properties', () => {
  const f = new FeedbackRegistry();
  const el = fakeEl();
  f.bind(el, { density: '--field-density', pressed: 'aria-pressed' });
  const w = lintFeedbackVars(f);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'feedback-non-css-var');
  assert.equal(w[0]!.severity, 'error');
  assert.match(w[0]!.message, /aria-pressed/);
});

test('lintSchedulerViolations surfaces off-phase reads', () => {
  const s = new FrameScheduler();
  const m = new MeasurementRegistry();
  m.setPhaseGuard(s.readGuard());
  s.on('write', () => m.measure(0, { width: 1, height: 1 }));
  s.runFrame();
  const w = lintSchedulerViolations(s);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'measurement-off-phase');
});

test('lintPlatform aggregates rules across the registries', () => {
  const el = fakeEl();
  const platform = createFieldPlatform(el);
  // induce: state on an unregistered element + a bad feedback binding
  platform.state.set(fakeEl(), 'attention', 0.7);
  platform.feedback.bind(el, { density: 'aria-bad' });
  const codes = lintPlatform(platform, { root: { querySelectorAll: () => [] } as unknown as ParentNode }).map((w) => w.code);
  assert.ok(codes.includes('state-unregistered'));
  assert.ok(codes.includes('feedback-non-css-var'));
});

test('a clean platform lints with no warnings', () => {
  const el = fakeEl();
  const platform = createFieldPlatform(el);
  platform.measure.register(el);
  platform.state.set(el, 'attention', 0.5);
  platform.feedback.bind(el, { attention: '--field-attention' });
  const w = lintPlatform(platform, { root: { querySelectorAll: () => [] } as unknown as ParentNode });
  assert.deepEqual(w, []);
});

test('lintFeedbackWritesUnread flags a data-feedback body no style rule reads (the producer-side gap)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  // one stylesheet rule reads --field-density (the consumer side of the contract).
  (globalThis as { document?: unknown }).document = {
    styleSheets: [{ cssRules: [{ selectorText: '.consumed', cssText: '.consumed{opacity:var(--field-density)}' }] }],
  };
  const mk = (matchSel: string | null) =>
    ({ getAttribute: () => '', matches: (sel: string) => sel === matchSel }) as unknown as Element;
  const consumed = mk('.consumed'); // a rule reads its vars → fine
  const unread = mk(null); // nothing reads its vars → flagged
  const root = { querySelectorAll: () => [consumed, unread] } as unknown as ParentNode;
  try {
    const w = lintFeedbackWritesUnread(root);
    assert.equal(w.length, 1, 'only the unread body is flagged');
    assert.equal(w[0]!.code, 'feedback-writes-unread');
    assert.equal(w[0]!.element, unread);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintFeedbackWritesUnread no-ops without a document (SSR / tests / cross-origin)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    const root = { querySelectorAll: () => { throw new Error('must not scan without a document'); } } as unknown as ParentNode;
    assert.deepEqual(lintFeedbackWritesUnread(root), []);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintFeedbackReadsUnwritten flags a data-body styled from a feedback var with no data-feedback (consumer-side gap)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    styleSheets: [{ cssRules: [{ selectorText: '.mass:hover', cssText: '.mass:hover{font-weight:var(--field-density)}' }] }],
  };
  // a [data-body] without data-feedback that the rule (cleaned to `.mass`) matches → flagged.
  const body = { hasAttribute: (a: string) => a === 'data-body' } as unknown as Element;
  const okBody = { hasAttribute: (a: string) => a === 'data-body' || a === 'data-feedback' } as unknown as Element;
  try {
    let root = { querySelectorAll: (sel: string) => (sel === '.mass' ? [body] : []) } as unknown as ParentNode;
    const w = lintFeedbackReadsUnwritten(root);
    assert.equal(w.length, 1, 'the un-opted body is flagged');
    assert.equal(w[0]!.code, 'feedback-reads-unwritten');
    assert.equal(w[0]!.element, body);
    // a matched body that DID opt into data-feedback is fine.
    root = { querySelectorAll: () => [okBody] } as unknown as ParentNode;
    assert.deepEqual(lintFeedbackReadsUnwritten(root), []);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintFeedbackReadsUnwritten no-ops without a document (SSR / tests / cross-origin)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    const root = { querySelectorAll: () => { throw new Error('must not scan without a document'); } } as unknown as ParentNode;
    assert.deepEqual(lintFeedbackReadsUnwritten(root), []);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

// ── compositing perf: the DPR2 / mix-blend fill trap (#405, #532) ─────────────────────────────
type StyleBag = Record<string, string>;
function fakeCanvas(style: StyleBag, backing: { width: number; height: number }) {
  return { tagName: 'CANVAS', style, width: backing.width, height: backing.height } as unknown as HTMLCanvasElement;
}
function canvasRoot(canvases: unknown[]): ParentNode {
  return { querySelectorAll: (sel: string) => (sel === 'canvas' ? canvases : []) } as unknown as ParentNode;
}

test('lintCompositingPerf flags a mounted, unsized, not-hidden full-viewport mix-blend canvas (#405/#532)', () => {
  const trap = fakeCanvas({ mixBlendMode: 'screen', position: 'fixed', inset: '0', display: '' }, { width: 0, height: 0 });
  const w = lintCompositingPerf(canvasRoot([trap]));
  assert.equal(w.length, 1);
  assert.equal(w[0]!.code, 'compositing-fill-trap');
  assert.equal(w[0]!.element, trap);
});

test('lintCompositingPerf stays quiet when display:none, when sized (drawing), or non-blend', () => {
  const hidden = fakeCanvas({ mixBlendMode: 'screen', position: 'fixed', inset: '0', display: 'none' }, { width: 0, height: 0 });
  const drawing = fakeCanvas({ mixBlendMode: 'screen', position: 'fixed', inset: '0', display: '' }, { width: 1440, height: 900 });
  const plain = fakeCanvas({ mixBlendMode: '', position: 'fixed', inset: '0', display: '' }, { width: 0, height: 0 });
  const inFlow = fakeCanvas({ mixBlendMode: 'screen', position: 'static', display: '' }, { width: 0, height: 0 });
  assert.deepEqual(lintCompositingPerf(canvasRoot([hidden, drawing, plain, inFlow])), []);
});

// ── reduced-motion: the a11y sibling of the silent-contract lint (RC-8, #325) ─────────────────
/** A CSSOM-ish document stub: flat style rules plus optional @media (prefers-reduced-motion) rules. */
function motionDoc(styleRules: Array<{ selectorText: string; cssText: string }>, reducedSelectors: string[]) {
  const cssRules: unknown[] = [...styleRules];
  if (reducedSelectors.length)
    cssRules.push({
      media: { mediaText: '(prefers-reduced-motion: reduce)' },
      cssRules: reducedSelectors.map((selectorText) => ({ selectorText, cssText: `${selectorText}{animation:none}` })),
    });
  return { styleSheets: [{ cssRules }] };
}
/** A [data-body] whose .matches() answers a fixed set of selectors; optional inline style. */
function bodyEl(matchSelectors: string[], style = ''): Element {
  return {
    getAttribute: (n: string) => (n === 'style' ? style : n === 'data-body' ? 'attract' : null),
    hasAttribute: (n: string) => n === 'data-body',
    matches: (sel: string) => matchSelectors.includes(sel),
  } as unknown as Element;
}

test('lintReducedMotion flags a body with INDEPENDENT motion (CSS animation) and NO reduced-motion equivalent', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = motionDoc(
    [{ selectorText: '.pulse', cssText: '.pulse{animation:throb 2s infinite}' }], // keyframes → engine can't gate
    [], // no reduced-motion branch at all
  );
  try {
    const body = bodyEl(['.pulse']);
    const root = { querySelectorAll: () => [body] } as unknown as ParentNode;
    const w = lintReducedMotion(root);
    assert.equal(w.length, 1, 'the independently-animating body with no reduced-motion branch is flagged');
    assert.equal(w[0]!.code, 'motion-without-reduced-motion');
    assert.equal(w[0]!.element, body);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintReducedMotion stays quiet when a prefers-reduced-motion rule matches the animating body', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = motionDoc(
    [{ selectorText: '.pulse', cssText: '.pulse{animation:throb 2s infinite}' }],
    ['.pulse'], // author gave it a reduced-motion branch → honoured
  );
  try {
    const body = bodyEl(['.pulse']);
    const root = { querySelectorAll: () => [body] } as unknown as ParentNode;
    assert.deepEqual(lintReducedMotion(root), [], 'a matching reduced-motion rule clears the warning');
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintReducedMotion does NOT flag feedback-var-driven motion — the engine gates it under reduced motion', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  // transform driven by --d: under prefers-reduced-motion the field freezes (dt=0), --d stops updating,
  // and this body stops moving. Already reduced-motion-safe via the engine — must NOT be flagged, even
  // with no per-body @media rule. This is the shape of the site's hundreds of real bodies.
  (globalThis as { document?: unknown }).document = motionDoc(
    [{ selectorText: '.driven', cssText: '.driven{transform:translateY(calc(var(--d) * 20px))}' }],
    [],
  );
  try {
    const driven = bodyEl(['.driven']);
    const root = { querySelectorAll: () => [driven] } as unknown as ParentNode;
    assert.deepEqual(lintReducedMotion(root), [], 'feedback-var-driven motion is engine-gated → exempt');
    // …and an inline feedback-driven transform is likewise exempt.
    const inlineDriven = bodyEl([], 'transform: translateY(calc(var(--field-attention) * 8px))');
    assert.deepEqual(lintReducedMotion({ querySelectorAll: () => [inlineDriven] } as unknown as ParentNode), []);
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintReducedMotion does not flag a static body (opacity/colour are not motion)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = motionDoc(
    [{ selectorText: '.calm', cssText: '.calm{opacity:var(--field-attention);color:red}' }], // opacity/color ≠ motion
    [],
  );
  try {
    const staticBody = bodyEl(['.calm']);
    const root = { querySelectorAll: () => [staticBody] } as unknown as ParentNode;
    assert.deepEqual(lintReducedMotion(root), [], 'opacity/colour changes are not motion → not flagged');
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('lintReducedMotion flags an inline STATIC transform, and no-ops without a document', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  // inline static transform (not feedback-driven), no matching reduced-motion rule → flagged
  (globalThis as { document?: unknown }).document = motionDoc([], []);
  try {
    const inline = bodyEl([], 'transform: translateY(-20px)');
    const w = lintReducedMotion({ querySelectorAll: () => [inline] } as unknown as ParentNode);
    assert.equal(w.length, 1);
    assert.equal(w[0]!.code, 'motion-without-reduced-motion');
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
  // SSR / tests / cross-origin: no document → no scan, no false positive
  const noDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    const root = { querySelectorAll: () => { throw new Error('must not scan without a document'); } } as unknown as ParentNode;
    assert.deepEqual(lintReducedMotion(root), []);
  } finally {
    (globalThis as { document?: unknown }).document = noDoc;
  }
});
