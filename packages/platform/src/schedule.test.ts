/**
 * FrameScheduler conformance — the six-phase loop must run in order, only fire phases that have
 * handlers, count frames, and catch off-phase layout reads. Pure logic, no DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameScheduler, PHASES, READ_PHASES } from './schedule.ts';
import { MeasurementRegistry } from './measurement.ts';
import { createFieldPlatform } from './platform.ts';

test('PHASES is the canonical six-phase order', () => {
  assert.deepEqual([...PHASES], ['discover', 'read', 'compute', 'state', 'write', 'render']);
  assert.deepEqual([...READ_PHASES], ['discover', 'read']);
});

test('runFrame visits handlers in phase order and reports what ran', () => {
  const s = new FrameScheduler();
  const order: string[] = [];
  // register out of order — the scheduler must still run them in PHASES order
  s.on('write', () => order.push('write'));
  s.on('discover', () => order.push('discover'));
  s.on('read', () => order.push('read'));
  s.on('render', () => order.push('render'));
  const report = s.runFrame(16);
  assert.deepEqual(order, ['discover', 'read', 'write', 'render']);
  assert.deepEqual(report.ran, ['discover', 'read', 'write', 'render'], 'phases with no handler are skipped');
  assert.equal(report.frame, 0);
  assert.equal(report.now, 16);
});

test('frame counter increments and ctx carries phase + frame', () => {
  const s = new FrameScheduler();
  const seen: Array<{ phase: string; frame: number }> = [];
  s.on('compute', (ctx) => seen.push({ phase: ctx.phase, frame: ctx.frame }));
  s.runFrame(0);
  s.runFrame(1);
  assert.equal(s.frame, 2);
  assert.deepEqual(seen, [{ phase: 'compute', frame: 0 }, { phase: 'compute', frame: 1 }]);
});

test('phase is null outside a frame and set during one', () => {
  const s = new FrameScheduler();
  assert.equal(s.phase, null);
  let inside: string | null = 'unset';
  s.on('state', () => (inside = s.phase));
  s.runFrame();
  assert.equal(inside, 'state');
  assert.equal(s.phase, null, 'cleared after the frame');
});

test('unsubscribe removes a handler', () => {
  const s = new FrameScheduler();
  let hits = 0;
  const off = s.on('read', () => hits++);
  s.runFrame();
  off();
  s.runFrame();
  assert.equal(hits, 1);
});

test('off-phase measurement is recorded as a violation (non-strict)', () => {
  const s = new FrameScheduler();
  const m = new MeasurementRegistry();
  m.setPhaseGuard(s.readGuard());
  // illegally read layout during the write phase
  s.on('write', () => m.measure(0, { width: 10, height: 10 }));
  const report = s.runFrame();
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0]!.op, 'measure');
  assert.equal(report.violations[0]!.phase, 'write');
  assert.deepEqual(report.violations[0]!.allowed, READ_PHASES);
});

test('reading in the read phase is clean', () => {
  const s = new FrameScheduler();
  const m = new MeasurementRegistry();
  m.setPhaseGuard(s.readGuard());
  s.on('read', () => m.measure(0, { width: 10, height: 10 }));
  const report = s.runFrame();
  assert.equal(report.violations.length, 0);
});

test('strict mode throws on an off-phase read', () => {
  const s = new FrameScheduler({ strict: true });
  const m = new MeasurementRegistry();
  m.setPhaseGuard(s.readGuard());
  s.on('write', () => m.measure());
  assert.throws(() => s.runFrame(), /write phase/);
});

test('direct (unmanaged) measurement is allowed — no frame, no guard error', () => {
  const s = new FrameScheduler({ strict: true });
  const m = new MeasurementRegistry();
  m.setPhaseGuard(s.readGuard());
  assert.doesNotThrow(() => m.measure(0, { width: 10, height: 10 })); // phase === null
});

test('createFieldPlatform routes measure→read and flush→write, guard installed', () => {
  // a tiny fake element with style + rect, EventTarget-backed (same pattern as platform.test.ts)
  const props: Record<string, string> = {};
  const el = new EventTarget() as unknown as Element & { isConnected: boolean };
  el.isConnected = true;
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  (el as unknown as { style: { setProperty: (k: string, v: string) => void } }).style = {
    setProperty: (k: string, v: string) => void (props[k] = v),
  };

  const p = createFieldPlatform(el, { strict: true });
  p.measure.register(el);
  p.feedback.bind(el, { density: '--field-density' });
  let computeRan = false;
  p.on('compute', () => (computeRan = true));
  p.state.set(el, 'density', 0.42);

  const report = p.tick(0, { width: 1000, height: 1000 });
  assert.deepEqual(report.ran, ['read', 'compute', 'write']);
  assert.equal(computeRan, true);
  assert.equal(props['--field-density'], '0.420');
  assert.equal(p.measure.for(el)!.rect.width, 100);
  assert.equal(report.violations.length, 0, 'read happened in the read phase');
});
