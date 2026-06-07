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
  lintStateRegistration,
  lintOverlayLinks,
  lintFeedbackVars,
  lintSchedulerViolations,
  lintPlatform,
} from './lint.ts';

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
