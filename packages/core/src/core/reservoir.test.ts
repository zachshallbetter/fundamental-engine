import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healWaves, tearBoundNear, tearBoundByForces } from './reservoir.ts';
import { FieldStore } from './field-store.ts';
import type { Wave, BoundParticle } from './currents.ts';
import type { Body, Particle, Force, ForceRegistry } from './types.ts';

// one flat line at y = 0.5·H = 400 (amp 0).
const flat = (): Wave[] => [
  { baseFrac: 0.5, amp: 0, freq: 0, phase: 0, speed: 0, color: [0, 0, 0], depth: 0, dir: 1, offsetY: 0 },
];

const mkP = (o: Partial<Particle> = {}): Particle => ({
  x: 500,
  y: 400,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
  ...o,
});

const mkForce = (token: string, extra: Partial<Force> = {}): Force => ({
  token,
  label: token,
  apply: () => {},
  ...extra,
});

// a registry with two force-bearing tokens, one modifier, and one source.
const REG: ForceRegistry = {
  attract: mkForce('attract'),
  gravity: mkForce('gravity'), // a non-canonical force — must still tear (§2.4)
  spotlight: mkForce('spotlight', { modify: () => ({}) }), // modifier — must NOT tear
  spawn: mkForce('spawn', { source: () => {} }), // pure source — must NOT tear
};

const mkBody = (tokens: string[], o: Partial<Body> = {}): Body =>
  ({
    tokens,
    vis: true,
    when: '',
    on: false,
    cx: 550,
    cy: 400,
    hw: 10,
    hh: 10,
    range: 280,
    ux: 1,
    uy: 0,
    ...o,
  }) as unknown as Body;

test('healWaves snaps a calm particle on the line into bound (conserved)', () => {
  const store = new FieldStore();
  store.add(mkP({ x: 500, y: 400 })); // on the line, calm
  const bound: BoundParticle[] = [];
  healWaves(store, bound, 10, flat(), 1000, 800, 0, () => 0); // rand 0 < 0.03 → snaps
  assert.equal(bound.length, 1);
  assert.equal(store.size, 0);
  assert.equal(bound[0]!.progress, 0.5); // x / W
});

test('healWaves stops once boundTarget is reached', () => {
  const store = new FieldStore();
  store.add(mkP());
  const bound: BoundParticle[] = [
    { wi: 0, progress: 0, phase: 0, size: 1, glow: false, speed: 0 },
  ];
  healWaves(store, bound, 1, flat(), 1000, 800, 0, () => 0);
  assert.equal(store.size, 1); // unchanged — already at target
  assert.equal(bound.length, 1);
});

test('healWaves ignores hot particles', () => {
  const store = new FieldStore();
  store.add(mkP({ heat: 0.5 }));
  const bound: BoundParticle[] = [];
  healWaves(store, bound, 10, flat(), 1000, 800, 0, () => 0);
  assert.equal(store.size, 1);
  assert.equal(bound.length, 0);
});

test('tearBoundNear releases bound matter near a blast (conserved)', () => {
  const store = new FieldStore();
  const bound: BoundParticle[] = [
    { wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }, // at (500, 400)
  ];
  tearBoundNear(bound, flat(), 510, 400, 320, 1000, 800, 0, (p) =>
    void store.add(mkP({ ...p }))
  );
  assert.equal(bound.length, 0);
  assert.equal(store.size, 1);
});

test('tearBoundByForces releases bound matter within a force range', () => {
  const store = new FieldStore();
  const bound: BoundParticle[] = [
    { wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }, // at (500, 400)
  ];
  tearBoundByForces(bound, flat(), [mkBody(['attract'])], REG, 1000, 800, 0, (p) =>
    void store.add(mkP({ ...p }))
  );
  assert.equal(bound.length, 0); // within range·0.8 (dist 50 < 224)
  assert.equal(store.size, 1);
});

test('tearBoundByForces tears for any force-bearing body, not just the canonical tokens', () => {
  const store = new FieldStore();
  const bound: BoundParticle[] = [{ wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }];
  // gravity is not in the bespoke canonical list — before generalization this did nothing.
  tearBoundByForces(bound, flat(), [mkBody(['gravity'])], REG, 1000, 800, 0, (p) =>
    void store.add(mkP({ ...p }))
  );
  assert.equal(bound.length, 0); // freed by the generic force-bearing path
  assert.equal(store.size, 1);
  const freed = store.particles[0]!;
  assert.ok(freed.vx > 0, 'kicked toward the body at +x, so vx is positive'); // body at 550, p at 500
});

test('tearBoundByForces leaves bound matter for a modifier-only body', () => {
  const bound: BoundParticle[] = [{ wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }];
  tearBoundByForces(bound, flat(), [mkBody(['spotlight'])], REG, 1000, 800, 0, () => {});
  assert.equal(bound.length, 1); // a pure modifier exerts no force → no tear
});

test('tearBoundByForces leaves bound matter for a source-only body', () => {
  const bound: BoundParticle[] = [{ wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }];
  tearBoundByForces(bound, flat(), [mkBody(['spawn'])], REG, 1000, 800, 0, () => {});
  assert.equal(bound.length, 1); // a pure source creates matter, doesn't move it → no tear
});

test('tearBoundByForces ignores selective gates (free agents only)', () => {
  const bound: BoundParticle[] = [{ wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }];
  tearBoundByForces(bound, flat(), [mkBody(['attract'], { when: 'hot' })], REG, 1000, 800, 0, () => {});
  assert.equal(bound.length, 1); // selective gate → bound untouched
});
