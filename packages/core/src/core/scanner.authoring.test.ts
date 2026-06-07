/**
 * Runtime authoring wiring (B3) — `data-intent` and `data-field-role` resolve to body params, with
 * explicit `data-*` winning over the compiled defaults (precedence §3). `authoredAttrs` is pure over
 * a minimal element shape, so it's tested without a DOM; `scanBodies` then feeds it the same way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authoredAttrs, parseBodyParams } from './scanner.ts';

/** A minimal element with just getAttribute/hasAttribute over a data-* record. */
function el(attrs: Record<string, string>): HTMLElement {
  return {
    getAttribute: (n: string) => (n.startsWith('data-') ? (attrs[n.slice(5)] ?? null) : null),
    hasAttribute: (n: string) => n.startsWith('data-') && n.slice(5) in attrs,
  } as unknown as HTMLElement;
}
const params = (attrs: Record<string, string>) => {
  const a = authoredAttrs(el(attrs));
  return a ? parseBodyParams(a) : null;
};

test('data-intent compiles to body tokens + defaults', () => {
  const p = params({ intent: 'draw-focus' });
  assert.ok(p);
  assert.deepEqual(p.tokens, ['attract']);
  assert.equal(p.range, 280);
  assert.equal(p.feedback, true);
});

test('data-intensity / data-risk flow into the compiled intent', () => {
  const p = params({ intent: 'draw-focus', intensity: '0.8' });
  assert.equal(p!.strength, 0.8);
  const risky = params({ intent: 'draw-focus', risk: 'high' });
  assert.ok(risky!.tokens.includes('thermal'), 'high risk adds a thermal layer');
});

test('explicit data-* wins over intent defaults (precedence §3)', () => {
  const p = params({ intent: 'draw-focus', strength: '2', range: '500' });
  assert.equal(p!.strength, 2);
  assert.equal(p!.range, 500);
  assert.deepEqual(p!.tokens, ['attract'], 'token still from intent');
});

test('data-field-role maps to a default token; sensor/display are feedback-only', () => {
  assert.deepEqual(params({ 'field-role': 'anchor' })!.tokens, ['tether']);
  assert.deepEqual(params({ 'field-role': 'boundary' })!.tokens, ['wall']);
  assert.deepEqual(params({ 'field-role': 'sink' })!.tokens, ['sink']);
  const sensor = params({ 'field-role': 'sensor' })!;
  assert.deepEqual(sensor.tokens, [], 'sensor exerts no force');
  assert.equal(sensor.feedback, true, 'but responds (feedback)');
});

test('no intent/role (or unknown) yields null — the plain data-body path is untouched', () => {
  assert.equal(authoredAttrs(el({})), null);
  assert.equal(authoredAttrs(el({ intent: 'not-an-intent' })), null);
  assert.equal(authoredAttrs(el({ 'field-role': 'bogus' })), null);
});
