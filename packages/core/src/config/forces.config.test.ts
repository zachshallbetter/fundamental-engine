import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORCES, FORMATIONS, CONDITIONS, PALETTE, FORCE_BY } from './forces.config.ts';

test('the canonical catalog has the nine forces', () => {
  assert.equal(FORCES.length, 9);
});

test('five formations and seven conditions', () => {
  assert.equal(FORMATIONS.length, 5);
  assert.equal(CONDITIONS.length, 7);
});

test('the palette mirrors the force colors, in order', () => {
  assert.equal(PALETTE.length, FORCES.length);
  assert.deepEqual(
    PALETTE,
    FORCES.map((f) => f.color)
  );
});

test('FORCE_BY indexes every force by id', () => {
  for (const f of FORCES) {
    assert.equal(FORCE_BY[f.id], f);
  }
});
