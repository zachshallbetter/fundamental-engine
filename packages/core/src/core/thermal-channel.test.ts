import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accumulateAt, causalityAt } from '../diagnostics/probes.ts';
import { attract } from '../forces/index.ts';
import type { Body } from './types.ts';

const makeBody = (over: Partial<Body> = {}): Body => ({
  el: null as unknown as HTMLElement,
  tokens: ['attract'],
  strength: 1,
  range: 300,
  absorbR: 64,
  capacity: 60,
  spin: 1,
  angle: 0,
  ux: 1,
  uy: 0,
  when: '',
  feedback: false,
  fmin: 0,
  fmax: 0,
  opsz: '',
  M: 1,
  cx: 250,
  cy: 100,
  hw: 50,
  hh: 20,
  on: false,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  ...over,
});

// attract heats matter only while engaged (b.on): `p.heat = max(p.heat, (1 - dist/range) * 0.9)`.
test('thermal: an engaged heating force records a thermal-channel contribution alongside linear', () => {
  const acc = accumulateAt({ attract }, ['attract'], makeBody({ on: true }), 100, 100);
  const linear = acc.attribution.find((a) => a.channel === 'linear' && a.force === 'attract');
  const thermal = acc.attribution.find((a) => a.channel === 'thermal' && a.force === 'attract');
  assert.ok(linear, 'linear Δv still recorded');
  assert.ok(thermal, 'thermal heat change recorded');
  assert.ok(typeof thermal!.contribution === 'number' && (thermal!.contribution as number) > 0, 'positive heat delta');
  assert.ok((acc.thermal ?? 0) > 0, 'net thermal channel accumulated');
});

test('thermal: a non-engaged force does not heat, so no thermal attribution', () => {
  const acc = accumulateAt({ attract }, ['attract'], makeBody({ on: false }), 100, 100);
  assert.ok(acc.attribution.every((a) => a.channel !== 'thermal'), 'no thermal entry when nothing heats');
  assert.equal(acc.thermal, undefined, 'thermal channel left absent');
  assert.ok(acc.attribution.some((a) => a.channel === 'linear'), 'linear still recorded (attract still pulls)');
});

test('thermal: causalityAt stays linear-only (the motion lane)', () => {
  const c = causalityAt({ attract }, ['attract'], makeBody({ on: true }), 100, 100);
  // one entry per force, all with numeric dvx/dvy — the thermal entry must NOT leak in as a bogus row.
  assert.equal(c.length, 1);
  assert.ok(Number.isFinite(c[0]!.dvx) && Number.isFinite(c[0]!.dvy));
});
