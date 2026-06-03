import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkAlpha } from './render-modes.ts';

test('linkAlpha fades to zero at the radius', () => {
  assert.equal(linkAlpha(0, 90), 0.12);
  assert.equal(linkAlpha(90, 90), 0);
  assert.equal(linkAlpha(45, 90), 0.06);
  assert.equal(linkAlpha(200, 90), 0);
});
