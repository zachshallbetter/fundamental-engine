import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import type { Particle } from './types.ts';

const mk = (x: number, y: number): Particle => ({
  x,
  y,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
});

test('add increments size; swap-remove decrements and keeps the rest', () => {
  const s = new FieldStore();
  const a = s.add(mk(0, 0));
  const b = s.add(mk(10, 10));
  assert.equal(s.size, 2);
  s.remove(a);
  assert.equal(s.size, 1);
  assert.ok(s.particles.includes(b));
  assert.ok(!s.particles.includes(a));
});

test('neighbors excludes self and respects the radius', () => {
  const s = new FieldStore(40);
  const a = s.add(mk(0, 0));
  const b = s.add(mk(20, 0));
  s.add(mk(500, 0));
  s.reindex();
  const n = s.neighbors(a, 30);
  assert.ok(n.includes(b));
  assert.ok(!n.includes(a));
  assert.equal(n.length, 1);
});

test('clear empties the pool', () => {
  const s = new FieldStore();
  s.add(mk(0, 0));
  s.clear();
  assert.equal(s.size, 0);
});
