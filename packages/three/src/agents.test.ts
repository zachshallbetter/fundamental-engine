/**
 * `FieldAgent` (#426) — the creatures primitive. Pins the steering contract against stub samplers:
 * a uniform field accelerates the agent along it and clamps at maxSpeed; a radial-in field draws it
 * to the centre; a dead field + drag coasts it to rest; the object's world position tracks the
 * projection. Renderer-free — `Object3D` and the projection are pure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D } from 'three';
import { PlaneProjection } from './project.ts';
import { FieldAgent } from './agents.ts';
import type { FieldSampler } from './samplers.ts';

const projection = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
const seededRng = (): (() => number) => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) >>> 0) / 2147483647;
};

function run(agent: FieldAgent, steps: number, dt = 1 / 60): void {
  for (let i = 0; i < steps; i++) agent.update(dt);
}

test('a uniform field accelerates the agent along it and clamps at maxSpeed', () => {
  const right: FieldSampler = { sample: () => ({ x: 1, y: 0 }) };
  const obj = new Object3D();
  const agent = new FieldAgent(obj, { projection, sampler: right, maxSpeed: 60, accel: 300, drag: 0, rng: seededRng() });
  agent.fieldPosition = { x: 100, y: 300 };

  run(agent, 120); // 2 s
  assert.ok(agent.fieldPosition.x > 100, 'moved along +x');
  assert.ok(Math.abs(agent.fieldPosition.y - 300) < 1e-6, 'no drift off-axis');
  const speed = Math.hypot(agent.velocity.x, agent.velocity.y);
  assert.ok(Math.abs(speed - 60) < 1e-6, `clamped at maxSpeed: ${speed}`);

  // the object's world position tracks the projection
  const w = projection.toWorld(agent.fieldPosition.x, agent.fieldPosition.y, 0, 0, 0);
  assert.ok(Math.abs(obj.position.x - w.x) < 1e-9 && Math.abs(obj.position.y - w.y) < 1e-9, 'world position matches');
});

test('a radial-in field draws the agent toward the centre', () => {
  const cx = 500, cy = 300;
  const inward: FieldSampler = { sample: (x, y) => ({ x: (cx - x) / 400, y: (cy - y) / 400 }) };
  const agent = new FieldAgent(new Object3D(), { projection, sampler: inward, maxSpeed: 120, drag: 1.2, rng: seededRng() });
  agent.fieldPosition = { x: 80, y: 80 };
  const d0 = Math.hypot(80 - cx, 80 - cy);

  run(agent, 600); // 10 s
  const d1 = Math.hypot(agent.fieldPosition.x - cx, agent.fieldPosition.y - cy);
  assert.ok(d1 < d0 * 0.5, `converged toward the centre: ${d0.toFixed(0)} → ${d1.toFixed(0)}`);
});

test('a dead field + drag coasts the agent to rest; zero dt is a no-op', () => {
  const dead: FieldSampler = { sample: () => ({ x: 0, y: 0 }) };
  const agent = new FieldAgent(new Object3D(), { projection, sampler: dead, drag: 3, rng: seededRng() });
  agent.fieldPosition = { x: 500, y: 300 };
  agent.velocity = { x: 50, y: -30 };

  run(agent, 300); // 5 s
  assert.ok(Math.hypot(agent.velocity.x, agent.velocity.y) < 0.5, 'coasted to ~rest');

  const before = { ...agent.fieldPosition };
  agent.update(0);
  assert.deepEqual(agent.fieldPosition, before, 'dt=0 is a no-op');
});

test('agents stay inside the field (soft edge bounce)', () => {
  const left: FieldSampler = { sample: () => ({ x: -1, y: 0 }) };
  const agent = new FieldAgent(new Object3D(), { projection, sampler: left, maxSpeed: 200, drag: 0, rng: seededRng() });
  agent.fieldPosition = { x: 30, y: 300 };
  run(agent, 240);
  assert.ok(agent.fieldPosition.x >= 0, 'never leaves the field');
});
