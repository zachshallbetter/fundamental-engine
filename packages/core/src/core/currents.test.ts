import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaves, buildBound, waveYat, waveSlope, type Wave } from './currents.ts';
import type { RGB } from './math.ts';

const palette: RGB[] = [
  [77, 163, 255],
  [45, 212, 191],
  [167, 139, 250],
];

const wave = (o: Partial<Wave> = {}): Wave => ({
  baseFrac: 0,
  amp: 0,
  freq: 0,
  phase: 0,
  speed: 0,
  color: [0, 0, 0],
  depth: 0,
  dir: 1,
  offsetY: 0,
  ...o,
});

test('buildWaves makes five layered waves', () => {
  const w = buildWaves(palette);
  assert.equal(w.length, 5);
  assert.equal(w[0]!.baseFrac, 0.24);
  assert.equal(w[4]!.amp, 22 + 4 * 15);
});

test('waveYat anchors at baseFrac·H with zero amplitude', () => {
  assert.equal(waveYat(wave({ baseFrac: 0.5 }), 100, 0, 800), 400);
});

test('waveYat oscillates by amplitude', () => {
  // sin(0 + π/2 + 0) = 1 → y = 0 + 0 + 1·10
  assert.ok(Math.abs(waveYat(wave({ amp: 10, phase: Math.PI / 2 }), 0, 0, 800) - 10) < 1e-9);
});

test('waveSlope is the derivative (cos·amp·freq)', () => {
  assert.ok(Math.abs(waveSlope(wave({ amp: 10, freq: 0.01 }), 0, 0) - 0.1) < 1e-9);
});

test('buildBound makes round(16·density) riders per wave', () => {
  const b = buildBound(5, 1, () => 0.5);
  assert.equal(b.length, 16 * 5);
});
