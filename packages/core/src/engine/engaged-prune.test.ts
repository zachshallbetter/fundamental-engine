/**
 * Engagement teardown across rescans (leak audit): a persistent field (e.g. the page <field-root>
 * with transition:persist) outlives the [data-hot] elements swapped under it. bindEngagement()
 * must drop engagements whose element has left the DOM — releasing their pointer/focus listeners
 * AND the strong ref the internal `engaged` array holds — so a long-lived field can't accumulate
 * detached nodes. Mirrors the emitter reconciliation; the `fxEngaged` guard still prevents
 * double-binding live elements.
 *
 * Also pins the keyboard-parity a11y contract (#665): the focus listeners are the BUBBLING
 * focusin/focusout (not the non-bubbling focus/blur), so keyboard focus on a [data-hot] container
 * or its focusable descendant reaches the same engaged state a mouse hover does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function hotEl() {
  const calls = { add: 0, remove: 0 };
  const handlers = new Map<string, Set<(e?: unknown) => void>>();
  return {
    dataset: {} as Record<string, string>,
    isConnected: true,
    closest: () => null,
    querySelectorAll: () => [] as unknown[],
    addEventListener: (type: string, fn: (e?: unknown) => void) => {
      calls.add++;
      (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(fn);
    },
    removeEventListener: (type: string, fn: (e?: unknown) => void) => {
      calls.remove++;
      handlers.get(type)?.delete(fn);
    },
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}),
    }),
    _calls: calls,
    _fire: (type: string): void => { handlers.get(type)?.forEach((fn) => fn()); },
    _bound: (type: string): boolean => (handlers.get(type)?.size ?? 0) > 0,
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
    assert.equal(el._calls.add, 4, 'pointerenter/leave + focusin/focusout bound');
    // Keyboard-parity contract (#665): the focus listeners are the BUBBLING focusin/focusout,
    // NOT the non-bubbling focus/blur — so focus on a descendant of a [data-hot] container
    // still engages the body, matching pointerenter for a mouse user.
    assert.ok(el._bound('pointerenter'), 'pointerenter (hover engage) bound');
    assert.ok(el._bound('pointerleave'), 'pointerleave (hover release) bound');
    assert.ok(el._bound('focusin'), 'focusin (keyboard engage, bubbles) bound');
    assert.ok(el._bound('focusout'), 'focusout (keyboard release, bubbles) bound');
    assert.ok(!el._bound('focus'), 'the non-bubbling focus is NOT used');
    assert.ok(!el._bound('blur'), 'the non-bubbling blur is NOT used');
    assert.equal(el.dataset.fxEngaged, '1', 'guard set so a rescan does not double-bind');
    field.scan();
    assert.equal(el._calls.add, 4, 'a rescan does NOT re-bind a still-connected element');
  } finally {
    field.destroy();
  }
});

test('keyboard focus reaches the same engaged state (data-active=1) as hover — mouse parity (#665)', () => {
  // The a11y contract: a keyboard user tabbing to a [data-hot] body (or its focusable descendant,
  // via the bubbling focusin) must produce the identical engaged state a mouse hover does. We fire
  // the two engage events and assert they leave the element in the same state, and that the matching
  // release events return it to rest identically.
  const hover = hotEl();
  const key = hotEl();
  const field = createField({} as HTMLCanvasElement, { host: hostWith([hover, key]), render: 'none' });
  try {
    field.scan();

    // mouse path: pointerenter engages, pointerleave releases.
    hover._fire('pointerenter');
    assert.equal(hover.dataset.active, '1', 'hover engages the body (data-active=1)');
    // keyboard path: focusin engages (bubbles up from a focused descendant), focusout releases.
    key._fire('focusin');
    assert.equal(key.dataset.active, '1', 'keyboard focus engages the body — same state as hover');
    assert.equal(key.dataset.active, hover.dataset.active, 'keyboard focus == hover engaged state');

    hover._fire('pointerleave');
    key._fire('focusout');
    assert.equal(hover.dataset.active, '0', 'hover release returns to rest');
    assert.equal(key.dataset.active, '0', 'keyboard release returns to rest — same as hover');
    assert.equal(key.dataset.active, hover.dataset.active, 'keyboard release == hover release state');
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

    assert.equal(el._calls.remove, 4, 'the disconnected engagement released its four listeners (pointerenter/leave + focusin/out)');
    assert.equal(el.dataset.fxEngaged, undefined, 'guard cleared so the element could re-bind if re-added');
  } finally {
    field.destroy();
  }
});
