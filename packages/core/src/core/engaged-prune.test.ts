/**
 * Engagement teardown across rescans (leak audit): a persistent field (e.g. the page <field-root>
 * with transition:persist) outlives the [data-hot] elements swapped under it. bindEngagement()
 * must drop engagements whose element has left the DOM — releasing their pointer/focus listeners
 * AND the strong ref the internal `engaged` array holds — so a long-lived field can't accumulate
 * detached nodes. Mirrors the emitter reconciliation; the `fxEngaged` guard still prevents
 * double-binding live elements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function hotEl() {
  const calls = { add: 0, remove: 0 };
  return {
    dataset: {} as Record<string, string>,
    isConnected: true,
    closest: () => null,
    querySelectorAll: () => [] as unknown[],
    addEventListener: () => { calls.add++; },
    removeEventListener: () => { calls.remove++; },
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}),
    }),
    _calls: calls,
  };
}

function hostWith(hotEls: unknown[]): FieldHost {
  const off = (): void => {};
  return {
    root: {
      // real DOM querySelectorAll only returns connected elements — a disconnected [data-hot]
      // node is gone from the query, so the prune (not a re-scan) is what releases it.
      querySelectorAll: (sel: string) =>
        sel.startsWith('[data-hot]') ? hotEls.filter((e) => (e as { isConnected: boolean }).isConnected) : [],
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: () => 1, cancelRaf: off, createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
}

test('engagement binds four listeners on a [data-hot] element', () => {
  const el = hotEl();
  const field = createField({} as HTMLCanvasElement, { host: hostWith([el]), render: 'none' });
  try {
    field.scan();
    assert.equal(el._calls.add, 4, 'pointerenter/leave + focus/blur bound');
    assert.equal(el.dataset.fxEngaged, '1', 'guard set so a rescan does not double-bind');
    field.scan();
    assert.equal(el._calls.add, 4, 'a rescan does NOT re-bind a still-connected element');
  } finally {
    field.destroy();
  }
});

test('a disconnected [data-hot] element is pruned on rescan — listeners released, no retained ref', () => {
  const el = hotEl();
  const field = createField({} as HTMLCanvasElement, { host: hostWith([el]), render: 'none' });
  try {
    field.scan();
    assert.equal(el._calls.add, 4);
    assert.equal(el._calls.remove, 0);

    el.isConnected = false; // content swapped out from under the persistent field
    field.scan();

    assert.equal(el._calls.remove, 4, 'the disconnected engagement released its four listeners');
    assert.equal(el.dataset.fxEngaged, undefined, 'guard cleared so the element could re-bind if re-added');
  } finally {
    field.destroy();
  }
});
