import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodyParams, type BodyAttrs } from './scanner.ts';

const attrs = (map: Record<string, string>): BodyAttrs => ({
  get: (name) => (name in map ? map[name] : null),
  has: (name) => name in map,
});

test('applies defaults when attributes are absent', () => {
  const b = parseBodyParams(attrs({ body: 'attract' }));
  assert.deepEqual(b.tokens, ['attract']);
  assert.equal(b.strength, 0.5);
  assert.equal(b.range, 280);
  assert.equal(b.absorbR, 64);
  assert.equal(b.capacity, 60);
  assert.equal(b.spin, 1);
  assert.equal(b.when, '');
  assert.equal(b.feedback, false);
});

test('parses composed tokens, numbers, angle, and feedback', () => {
  const b = parseBodyParams(
    attrs({
      body: 'absorb attract',
      strength: '0.8',
      range: '360',
      absorb: '74',
      max: '44',
      angle: '90',
      when: 'hot',
      feedback: '',
    })
  );
  assert.deepEqual(b.tokens, ['absorb', 'attract']);
  assert.equal(b.strength, 0.8);
  assert.equal(b.range, 360);
  assert.equal(b.absorbR, 74);
  assert.equal(b.capacity, 44);
  assert.equal(b.when, 'hot');
  assert.equal(b.feedback, true);
  assert.ok(Math.abs(b.angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(b.ux - 0) < 1e-9);
  assert.ok(Math.abs(b.uy - 1) < 1e-9);
  // source mass M mirrors strength (k_g = 1)
  assert.equal(b.M, 0.8);
});
