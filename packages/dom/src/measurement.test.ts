/**
 * MeasurementRegistry — the read-phase geometry snapshot. Pins the semantics of the identity-keyed
 * `for()` lookup (#991: O(1) via a Map built during measure, replacing an O(N) snapshot scan) and the
 * self-healing prune of disconnected elements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeasurementRegistry } from './measurement.ts';

type Fake = Element & { isConnected: boolean };

let n = 0;
function fakeEl(x: number, y: number, w = 10, h = 10, connected = true): Fake {
  const el = {} as unknown as Fake;
  (el as { isConnected: boolean }).isConnected = connected;
  (el as { id: string }).id = `el${n++}`;
  (el as { getBoundingClientRect(): DOMRect }).getBoundingClientRect = () =>
    ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON() {} }) as DOMRect;
  return el;
}

const VP = { width: 1000, height: 1000 };

test('for() returns the current measurement for a registered element', () => {
  const reg = new MeasurementRegistry();
  const a = fakeEl(100, 200);
  const b = fakeEl(300, 400);
  reg.register(a);
  reg.register(b);
  reg.measure(0, VP);

  const ma = reg.for(a);
  const mb = reg.for(b);
  assert.ok(ma && mb);
  assert.equal(ma.rect.x, 100);
  assert.equal(mb.rect.x, 300);
  // identity-keyed: the returned object is the same instance the snapshot holds
  assert.equal(reg.last().find((m) => m.element === a), ma);
});

test('for() returns undefined for an unregistered element', () => {
  const reg = new MeasurementRegistry();
  const a = fakeEl(0, 0);
  reg.register(a);
  reg.measure(0, VP);
  assert.equal(reg.for(fakeEl(5, 5)), undefined);
});

test('for() matches a brute-force scan of the snapshot (equivalence with the old linear lookup)', () => {
  const reg = new MeasurementRegistry();
  const els = Array.from({ length: 50 }, (_, i) => fakeEl(i * 3, i * 5));
  els.forEach((e) => reg.register(e));
  const snap = reg.measure(0, VP);
  for (const e of els) {
    const brute = snap.find((m) => m.element === e);
    assert.equal(reg.for(e), brute, 'O(1) lookup agrees with the linear scan');
  }
});

test('disconnected elements are pruned on measure and drop out of for()', () => {
  const reg = new MeasurementRegistry();
  const live = fakeEl(10, 10);
  const dead = fakeEl(20, 20);
  reg.register(live);
  reg.register(dead);
  reg.measure(0, VP);
  assert.ok(reg.for(dead), 'present while connected');

  (dead as { isConnected: boolean }).isConnected = false;
  reg.measure(1, VP);
  assert.equal(reg.size, 1, 'entry pruned from the registry');
  assert.equal(reg.for(dead), undefined, 'pruned element no longer resolves via for()');
  assert.ok(reg.for(live), 'live element still resolves');
});

test('the index is rebuilt each measure — a re-registered element reflects its new box', () => {
  const reg = new MeasurementRegistry();
  const a = fakeEl(0, 0);
  reg.register(a);
  reg.measure(0, VP);
  assert.equal(reg.for(a)!.rect.x, 0);

  const moved = fakeEl(500, 500);
  reg.register(moved);
  reg.measure(1, VP);
  // stale element from a prior frame that was never registered again must not linger in the index
  assert.equal(reg.for(moved)!.rect.x, 500);
});
