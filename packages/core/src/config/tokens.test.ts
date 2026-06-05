import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssTokens } from './tokens.ts';

test('cssTokens emits a CSS var per force + coherence + ease (§25.2)', () => {
  const css = cssTokens();
  assert.ok(css.startsWith(':root {'));
  assert.ok(css.includes('--f-attract: #4da3ff;'));
  assert.ok(css.includes('--f-sink: #ff6e9c;'));
  assert.ok(css.includes('--f-condition: var(--f-jet);'));
  assert.ok(css.includes('--coherence: #ffce6b;'));
  assert.ok(css.includes('--ease: cubic-bezier(0.16, 1, 0.3, 1);'));
});

test('cssTokens accepts a custom selector', () => {
  assert.ok(cssTokens('.field').startsWith('.field {'));
});
