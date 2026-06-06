/**
 * Field-line tracing — tests (field-systems plan, Stage B2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceFieldLine, traceFieldLines } from './fieldlines.ts';
import { dipoleField, type Pole } from './geometry.ts';

// a dipole in positive canvas space: + pole at (100, 200), − pole at (300, 200)
const poles: Pole[] = [
  { x: 100, y: 200, q: 1 },
  { x: 300, y: 200, q: -1 },
];
const sample = (x: number, y: number) => dipoleField(poles, x, y);
const bounds = { w: 400, h: 400 };

const finite = (line: { x: number; y: number }[]): boolean =>
  line.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

test('traceFieldLine: a uniform field traces a straight line along itself', () => {
  const line = traceFieldLine(() => ({ x: 1, y: 0 }), 0, 0, { step: 5, maxSteps: 10 });
  assert.ok(line.length > 2);
  assert.ok(finite(line));
  // all points lie on y = 0 and x increases monotonically
  assert.ok(line.every((p) => Math.abs(p.y) < 1e-9));
  for (let i = 1; i < line.length; i++) assert.ok(line[i]!.x >= line[i - 1]!.x);
});

test('traceFieldLine: a dipole line flows from the + pole toward the − pole', () => {
  // seed on the axis between the poles, where the field points straight toward −
  const line = traceFieldLine(sample, 200, 200, { step: 4, maxSteps: 600, bounds });
  assert.ok(line.length > 2);
  assert.ok(finite(line));
  const start = line[0]!;
  const end = line[line.length - 1]!;
  // the full line runs from the + pole side to the − pole side
  assert.ok(end.x > start.x, `line should run + → −: ${start.x} → ${end.x}`);
  assert.ok(start.x < 200 && end.x > 200, 'spans both sides of the midpoint');
});

test('traceFieldLine: a zero field yields just the seed', () => {
  const line = traceFieldLine(() => ({ x: 0, y: 0 }), 5, 5, { maxSteps: 50 });
  assert.equal(line.length, 1);
  assert.deepEqual(line[0], { x: 5, y: 5 });
});

test('traceFieldLine: bounds stop the line leaving the viewport', () => {
  const line = traceFieldLine(() => ({ x: 1, y: 0 }), 0, 50, { step: 10, maxSteps: 1000, bounds: { w: 100, h: 100 } });
  assert.ok(line.every((p) => p.x <= 100 + 10 + 1e-9)); // never past the right edge + one step margin
});

test('traceFieldLines: traces one polyline per non-degenerate seed', () => {
  // a small set of seeds spread around the + pole (100, 200)
  const seeds = [
    { x: 114, y: 200 },
    { x: 100, y: 214 },
    { x: 86, y: 200 },
    { x: 100, y: 186 },
  ];
  const lines = traceFieldLines(sample, seeds, { step: 4, maxSteps: 400, bounds });
  assert.ok(lines.length >= 1);
  assert.ok(lines.every((l) => l.length > 1 && finite(l)));
});
