import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaves, buildBound, waveYat, waveSlope, waveRAt, waveDistance, type Wave } from './currents.ts';
import type { RGB } from '../math/math.ts';

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

test('waveYat bends toward the pull (the spine)', () => {
  const w = wave({ baseFrac: 0.5 }); // line at y = 400 (H = 800), flat
  const flatY = waveYat(w, 0, 0, 800);
  const bent = waveYat(w, 0, 0, 800, 1, 1, { x: 0, y: 600, k: 1 });
  assert.ok(bent > flatY); // pulled down toward y = 600
  assert.ok(bent < 600); // but only partway
});

test('waveRAt calculates radial distance at theta', () => {
  const w = wave({ baseFrac: 0.5, amp: 10, phase: Math.PI / 2 });
  const r = waveRAt(w, 0, 0, 100);
  // Math.round(0 * 2500) = 0 ripple, baseR = 0.5 * 100 = 50.
  // waveRAt = 50 + sin(0 + PI/2) * 10 = 60
  assert.ok(Math.abs(r - 60) < 1e-9);
});

test('waveDistance calculates polar distance', () => {
  const w = wave({ baseFrac: 0.5, amp: 10, phase: Math.PI / 2 });
  const center = { x: 100, y: 100 };
  const px = 100 + 70; // 70px right of center -> theta = 0, distance to center = 70.
  const py = 100;
  // W=200, H=200 -> maxRadius = 200 * 0.48 = 96
  // baseR = 0.5 * 96 = 48
  // rWave = 48 + sin(0 + PI/2) * 10 = 58
  // distance from 70 to 58 is 12.
  const res = waveDistance(w, px, py, 0, 200, 200, 'circular', center);
  assert.ok(Math.abs(res.dist - 12) < 1e-9);
  assert.ok(Math.abs(res.theta - 0) < 1e-9);
});
