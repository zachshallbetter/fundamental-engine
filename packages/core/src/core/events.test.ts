import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldEventCoalescer, parseEventBindings, triggerActive } from './events.ts';
import type { Body } from './types.ts';

/** A minimal Body stand-in for coalescer keying (only `el` identity is read). */
function fakeBody(tag: string): Body {
  return { el: { tag } as unknown as HTMLElement } as unknown as Body;
}

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

test('#684 coalescer: N records of one (source, type) in a frame → one delivery (last-wins payload)', () => {
  const c = new FieldEventCoalescer();
  const body = fakeBody('sink');
  // Simulate many force-passes raising `absorb` on the SAME body within one frame.
  for (let i = 1; i <= 7; i++) c.record('absorb', { body, count: i });
  const got: Array<{ type: string; count: number }> = [];
  c.flush((type, payload) => got.push({ type, count: (payload as { count: number }).count }));
  assert.equal(got.length, 1, `seven passes coalesce to one delivery: ${got.length}`);
  assert.equal(got[0]!.count, 7, 'the surviving payload is the last write (last-wins)');
  // The buffer is drained — a second flush with no new records delivers nothing.
  let again = 0;
  c.flush(() => { again++; });
  assert.equal(again, 0, 'flush drains the buffer; nothing re-delivered next frame');
});

test('#684 coalescer: distinct sources and distinct types each get their own delivery', () => {
  const c = new FieldEventCoalescer();
  const a = fakeBody('a');
  const b = fakeBody('b');
  // same type, two different source bodies → two deliveries
  c.record('absorb', { body: a, count: 1 });
  c.record('absorb', { body: b, count: 2 });
  // different type on the same body a → its own delivery (types are independent)
  c.record('release', { body: a, count: 9 });
  const got: string[] = [];
  c.flush((type, payload) => got.push(`${type}:${(payload as { count: number }).count}`));
  assert.equal(got.length, 3, `two sources × absorb + one release = three deliveries: ${got.join(',')}`);
  assert.ok(got.includes('absorb:1') && got.includes('absorb:2') && got.includes('release:9'));
});

test('#684 coalescer: relational events key on the pair — distinct pairs survive, same pair collapses', () => {
  const c = new FieldEventCoalescer();
  const a = fakeBody('a');
  const b = fakeBody('b');
  const d = fakeBody('d');
  // a meets b twice in one frame (same pair, either order) → one delivery
  c.record('met', { a, b });
  c.record('met', { a: b, b: a }); // unordered: same pair
  // a meets d (distinct pair) → its own delivery
  c.record('met', { a, b: d });
  let mets = 0;
  c.flush((type) => { if (type === 'met') mets++; });
  assert.equal(mets, 2, `same pair collapses, distinct pair survives: ${mets}`);
});
