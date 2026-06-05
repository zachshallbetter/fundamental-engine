import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healWaves, tearBoundNear, tearBoundByForces } from './reservoir.ts';
import { FieldStore } from './field-store.ts';
import type { Wave, BoundParticle } from './currents.ts';
import type { Body, Particle } from './types.ts';

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
  const body = {
    tokens: ['attract'],
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
  } as unknown as Body;
  tearBoundByForces(bound, flat(), [body], 1000, 800, 0, (p) => void store.add(mkP({ ...p })));
  assert.equal(bound.length, 0); // within range·0.8 (dist 50 < 224)
  assert.equal(store.size, 1);
});

test('tearBoundByForces ignores selective gates (free agents only)', () => {
  const bound: BoundParticle[] = [{ wi: 0, progress: 0.5, phase: 0, size: 1, glow: false, speed: 0 }];
  const body = {
    tokens: ['attract'],
    vis: true,
    when: 'hot',
    on: false,
    cx: 550,
    cy: 400,
    range: 280,
  } as unknown as Body;
  tearBoundByForces(bound, flat(), [body], 1000, 800, 0, () => {});
  assert.equal(bound.length, 1); // selective gate → bound untouched
});
