import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEventBindings, triggerActive } from './events.ts';

test('parseEventBindings splits trigger:event pairs (event keeps its colon)', () => {
  const b = parseEventBindings('dense:field:lit, captured:field:dock');
  assert.equal(b.length, 2);
  assert.deepEqual(b[0], { trigger: 'dense', event: 'field:lit', armed: false });
  assert.deepEqual(b[1], { trigger: 'captured', event: 'field:dock', armed: false });
});

test('parseEventBindings ignores blanks/malformed', () => {
  assert.equal(parseEventBindings('').length, 0);
  assert.equal(parseEventBindings('  ,  ').length, 0);
});

test('triggerActive evaluates the built-in triggers', () => {
  assert.equal(triggerActive('dense', { d: 0.7, on: false, accreted: 0 }), true);
  assert.equal(triggerActive('dense', { d: 0.5, on: false, accreted: 0 }), false);
  assert.equal(triggerActive('sparse', { d: 0.1, on: false, accreted: 0 }), true);
  assert.equal(triggerActive('engaged', { d: 0, on: true, accreted: 0 }), true);
  assert.equal(triggerActive('captured', { d: 0, on: false, accreted: 3 }), true);
  assert.equal(triggerActive('nope', { d: 1, on: true, accreted: 9 }), false);
});
