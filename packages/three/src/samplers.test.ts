/**
 * `traceStreamline` — the pure core of the native field visuals. It integrates `FieldHandle.sample`
 * to follow the flow; the tube geometry wraps these points. Renderer-free with a stub sampler.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceStreamline, type FieldSampler } from './samplers.ts';

const bounds = { width: 1000, height: 600 };

test('a uniform field traces a straight line to the edge', () => {
  const right: FieldSampler = { sample: () => ({ x: 1, y: 0 }) }; // constant +x
  const line = traceStreamline(right, { x: 100, y: 300 }, { ...bounds, stepLen: 10, maxSteps: 200 });
  assert.ok(line.length > 2, 'it advanced');
  for (let i = 1; i < line.length; i++) assert.ok(line[i]!.x > line[i - 1]!.x, 'monotonic in x');
  assert.ok(line[line.length - 1]!.x > 900, 'reached near the right edge before stopping');
  assert.ok(Math.abs(line[line.length - 1]!.y - 300) < 1e-6, 'y unchanged');
});

test('a stalled (zero) field yields just the seed', () => {
  const dead: FieldSampler = { sample: () => ({ x: 0, y: 0 }) };
  const line = traceStreamline(dead, { x: 500, y: 300 }, bounds);
  assert.equal(line.length, 1, 'no step taken');
});

test('a radial-in field converges toward the centre', () => {
  const cx = 500;
  const cy = 300;
  const inward: FieldSampler = { sample: (x, y) => ({ x: cx - x, y: cy - y }) }; // points to centre
  const start = { x: 100, y: 100 };
  const line = traceStreamline(inward, start, { ...bounds, stepLen: 12, maxSteps: 200 });
  const d0 = Math.hypot(start.x - cx, start.y - cy);
  const last = line[line.length - 1]!;
  const d1 = Math.hypot(last.x - cx, last.y - cy);
  assert.ok(d1 < d0, 'ends closer to the centre than it started');
});
