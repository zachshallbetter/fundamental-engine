/**
 * `bodyElements` / `BODY_SELECTOR` (Phase D2) — the single selector source of truth shared with the
 * platform MeasurementRegistry. Tested over a stub root so no DOM is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyElements, BODY_SELECTOR } from './scanner.ts';

test('BODY_SELECTOR covers every body-producing authoring form', () => {
  assert.match(BODY_SELECTOR, /\[data-body\]/);
  assert.match(BODY_SELECTOR, /\[data-preset\]/);
  assert.match(BODY_SELECTOR, /\[data-intent\]:not\(\[data-body\]\)/);
  assert.match(BODY_SELECTOR, /\[data-field-role\]:not\(\[data-body\]\):not\(\[data-intent\]\)/);
});

test('bodyElements queries the root with BODY_SELECTOR and returns the matches in order', () => {
  let captured = '';
  const a = {} as Element;
  const b = {} as Element;
  const root = {
    querySelectorAll: (sel: string) => {
      captured = sel;
      return [a, b] as unknown as NodeListOf<Element>;
    },
  } as unknown as ParentNode;
  const els = bodyElements(root);
  assert.equal(captured, BODY_SELECTOR, 'uses the shared selector, no drift');
  assert.deepEqual(els, [a, b]);
});
