import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackTarget, feedbackWeight } from './feedback.ts';

test('feedbackTarget: count/20 plus an on-state floor, clamped', () => {
  assert.equal(feedbackTarget(0, false), 0);
  assert.equal(feedbackTarget(10, false), 0.5);
  assert.equal(feedbackTarget(0, true), 0.45);
  assert.equal(feedbackTarget(100, false), 1); // clamped
});

test('feedbackWeight interpolates the variable-font axis', () => {
  assert.equal(feedbackWeight(600, 800, 0), 600);
  assert.equal(feedbackWeight(600, 800, 1), 800);
  assert.equal(feedbackWeight(600, 800, 0.5), 700);
});
