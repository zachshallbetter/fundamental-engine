import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditions, passes } from './conditions.ts';
import type { Body, Env, Particle } from './types.ts';

const body = (over: Partial<Body> = {}): Body => ({
  el: {} as HTMLElement,
  tokens: [],
  strength: 0.5,
  range: 280,
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
  M: 0.5,
  cx: 0,
  cy: 0,
  hw: 0,
  hh: 0,
  on: false,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  ...over,
});

const part = (over: Partial<Particle> = {}): Particle => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
  ...over,
});

test('fast / slow gate on speed', () => {
  assert.equal(conditions.fast(body(), part({ vx: 1, vy: 0 })), true); // 1 > 0.9
  assert.equal(conditions.fast(body(), part({ vx: 0.1, vy: 0 })), false);
  assert.equal(conditions.slow(body(), part({ vx: 0.1, vy: 0 })), true); // 0.01 < 0.22
});

test('hot / cool gate on heat', () => {
  assert.equal(conditions.hot(body(), part({ heat: 0.5 })), true);
  assert.equal(conditions.cool(body(), part({ heat: 0.02 })), true);
  assert.equal(conditions.cool(body(), part({ heat: 0.5 })), false);
});

test('active gates on engagement', () => {
  assert.equal(conditions.active(body({ on: true }), part()), true);
  assert.equal(conditions.active(body({ on: false }), part()), false);
});

test('passes: empty gate always passes; unknown gate passes', () => {
  assert.equal(passes(conditions, body({ when: '' }), part()), true);
  assert.equal(passes(conditions, body({ when: 'nope' }), part()), true);
  assert.equal(passes(conditions, body({ when: 'hot' }), part({ heat: 0 })), false);
});

test('scrolling gates on page scroll speed (env.scrollV)', () => {
  assert.equal(conditions.scrolling!(body(), part(), { scrollV: 0.5 } as Env), true); // > 0.25
  assert.equal(conditions.scrolling!(body(), part(), { scrollV: 0.1 } as Env), false);
  assert.equal(conditions.scrolling!(body(), part()), false); // no env (conformance) → inert
  // passes() threads env through to the predicate
  assert.equal(passes(conditions, body({ when: 'scrolling' }), part(), { scrollV: 1 } as Env), true);
  assert.equal(passes(conditions, body({ when: 'scrolling' }), part()), false);
});
