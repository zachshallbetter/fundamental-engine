/**
 * Fieldflow conformance matrix (testing-and-conformance §4, agent-handoff "Required Fieldflow Tests").
 * Direct unit tests of `fieldflow.apply()` against a mock `env.fieldAt`, covering the checks the
 * scenario catalog didn't: does work, moves neutral matter, zero field → no motion, range-0 global,
 * beyond-range inert. (The catalog already proves "neutral matter follows a charge field line".)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldflow } from './extended.ts';
import type { Body, Env, Particle, Vec2 } from '../core/types.ts';

const body = (over: Partial<Body> = {}): Body =>
  ({ range: 0, strength: 1, on: false, ...over }) as unknown as Body;
const env = (fieldAt: (x: number, y: number) => Vec2, over: Partial<Env> = {}): Env =>
  ({ dist: 0, c: 12, fieldAt, ...over }) as unknown as Env;
const particle = (over: Partial<Particle> = {}): Particle =>
  ({ x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...over }) as Particle;
const speed = (p: Particle): number => Math.hypot(p.vx, p.vy);

test('fieldflow does work: a moving particle accelerates along the field', () => {
  const p = particle({ vx: 0.5, vy: 0 });
  const before = speed(p);
  fieldflow.apply(body(), p, env(() => ({ x: 1, y: 0 })));
  assert.ok(speed(p) > before, 'speed increases (fieldflow does work)');
});

test('fieldflow moves neutral matter from rest', () => {
  const p = particle(); // uncharged, at rest
  fieldflow.apply(body(), p, env(() => ({ x: 1, y: 0 })));
  assert.ok(Math.abs(p.vx) > 0, 'neutral matter is set in motion along the field');
});

test('fieldflow: zero field produces no motion', () => {
  const p = particle({ vx: 0.5, vy: 0.2 });
  const before = { vx: p.vx, vy: p.vy };
  fieldflow.apply(body(), p, env(() => ({ x: 0, y: 0 })));
  assert.deepEqual({ vx: p.vx, vy: p.vy }, before, 'a null field leaves velocity unchanged');
});

test('fieldflow: range 0 follows the global field; beyond a finite range it is inert', () => {
  const global = particle({ vx: 0.5 });
  fieldflow.apply(body({ range: 0 }), global, env(() => ({ x: 1, y: 0 }), { dist: 99999 }));
  assert.ok(speed(global) > 0.5, 'range 0 acts regardless of distance');

  const out = particle({ vx: 0.5 });
  const before = { vx: out.vx, vy: out.vy };
  fieldflow.apply(body({ range: 100 }), out, env(() => ({ x: 1, y: 0 }), { dist: 200 }));
  assert.deepEqual({ vx: out.vx, vy: out.vy }, before, 'beyond range, no effect');
});

test('fieldflow never exceeds the speed-of-light cap', () => {
  const p = particle({ vx: 11.9, vy: 0 });
  for (let i = 0; i < 50; i++) fieldflow.apply(body(), p, env(() => ({ x: 1, y: 0 })));
  assert.ok(speed(p) <= 12 + 1e-6, 'clamped to c');
});
