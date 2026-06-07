/**
 * @field-ui/platform foundation tests. The registries are exercised with tiny EventTarget-backed
 * fake elements (a recorded style + getBoundingClientRect), so the read/state/write logic is
 * verified without a real DOM — the same pattern core uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeasurementRegistry } from './measurement.ts';
import { StateRegistry } from './state.ts';
import { FeedbackRegistry } from './feedback.ts';
import { createFieldPlatform } from './platform.ts';

interface FakeEl extends Element {
  props: Record<string, string>;
}
function fakeEl(rect: { x: number; y: number; w: number; h: number }, connected = true): FakeEl {
  const props: Record<string, string> = {};
  const el = new EventTarget() as unknown as FakeEl & { isConnected: boolean };
  el.isConnected = connected;
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: rect.x, top: rect.y, width: rect.w, height: rect.h, right: rect.x + rect.w, bottom: rect.y + rect.h, x: rect.x, y: rect.y }) as DOMRect;
  (el as unknown as { style: { setProperty: (k: string, v: string) => void } }).style = {
    setProperty: (k: string, v: string) => void (props[k] = v),
  };
  el.props = props;
  return el;
}

const VP = { width: 1000, height: 1000 };

test('MeasurementRegistry snapshots geometry + visibility, prunes disconnected', () => {
  const m = new MeasurementRegistry();
  const a = fakeEl({ x: 100, y: 100, w: 200, h: 100 });
  const off = fakeEl({ x: 2000, y: 0, w: 50, h: 50 });
  const gone = fakeEl({ x: 0, y: 0, w: 10, h: 10 }, false);
  m.register(a);
  m.register(off);
  m.register(gone);
  const snap = m.measure(1, VP);
  assert.equal(snap.length, 2, 'disconnected pruned');
  const ma = m.for(a)!;
  assert.equal(ma.rect.cx, 200);
  assert.equal(ma.rect.cy, 150);
  assert.ok(ma.visible && ma.visibilityRatio === 1);
  assert.equal(m.for(off)!.visibilityRatio, 0);
  assert.equal(m.for(off)!.visible, false);
});

test('StateRegistry holds typed values and notifies on change only', () => {
  const s = new StateRegistry();
  const el = fakeEl({ x: 0, y: 0, w: 1, h: 1 });
  let hits = 0;
  s.observe(el, 'density', () => hits++);
  s.set(el, 'density', 0.5);
  s.set(el, 'density', 0.5); // unchanged → no notify
  s.set(el, 'density', 0.8);
  assert.equal(hits, 2);
  assert.equal(s.number(el, 'density'), 0.8);
  s.set(el, 'lit', true);
  s.set(el, 'pull', { x: 1, y: -1 });
  assert.deepEqual(s.get(el, 'lit'), { type: 'boolean', value: true });
  assert.deepEqual(s.get(el, 'pull'), { type: 'vector2', x: 1, y: -1 });
});

test('FeedbackRegistry writes bound vars (dual --field/--forces) on flush', () => {
  const s = new StateRegistry();
  const f = new FeedbackRegistry();
  const el = fakeEl({ x: 0, y: 0, w: 1, h: 1 });
  f.bind(el, { density: '--field-density' });
  s.set(el, 'density', 0.5);
  f.flush(s, 0);
  assert.equal(el.props['--field-density'], '0.500');
  assert.equal(el.props['--forces-density'], '0.500', 'mirrored to the forces alias');
  f.set(el, { '--field-heat': 0.25 });
  f.flush(s, 0);
  assert.equal(el.props['--field-heat'], '0.25');
  assert.equal(el.props['--forces-heat'], '0.25');
});

test('FeedbackRegistry fires thresholded, hysteretic events (field:* + forces:* twins)', () => {
  const s = new StateRegistry();
  const f = new FeedbackRegistry();
  const el = fakeEl({ x: 0, y: 0, w: 1, h: 1 });
  const got: string[] = [];
  el.addEventListener('field:lit', () => got.push('field:lit'));
  el.addEventListener('forces:lit', () => got.push('forces:lit'));
  el.addEventListener('field:dim', () => got.push('field:dim'));
  f.threshold(el, 'field:lit', { metric: 'density', enter: 0.7, exit: 0.4, exitEvent: 'field:dim' });
  s.set(el, 'density', 0.2);
  f.flush(s, 0); // below enter
  s.set(el, 'density', 0.9);
  f.flush(s, 100); // crosses up
  s.set(el, 'density', 0.3);
  f.flush(s, 200); // crosses down
  assert.deepEqual(got, ['field:lit', 'forces:lit', 'field:dim']);
});

test('createFieldPlatform.tick runs read then write', () => {
  const el = fakeEl({ x: 0, y: 0, w: 100, h: 100 });
  const p = createFieldPlatform(el);
  p.measure.register(el);
  p.feedback.bind(el, { attention: '--field-attention' });
  p.state.set(el, 'attention', 0.6);
  p.tick(0, VP);
  assert.equal(el.props['--field-attention'], '0.600');
  assert.equal(p.measure.for(el)!.rect.width, 100);
});
