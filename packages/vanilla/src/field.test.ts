import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForcesField, mountField, createField } from './index.ts';

/**
 * A throwaway, zero-dependency DOM stub — just enough surface for `createField` to construct
 * and tear down. No animation frame ever runs (we hand back a fake `requestAnimationFrame`
 * that never invokes its callback), so only the synchronous mount path is exercised. The
 * repo forbids a test framework or jsdom, so we hand-roll the few globals it touches.
 */
function installDOM(): { body: { children: unknown[] }; makeCanvas: () => HTMLCanvasElement } {
  const noop = (): void => {};
  const makeCanvas = (): HTMLCanvasElement => {
    const node = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      _parent: null as { _remove(n: unknown): void } | null,
      setAttribute: noop,
      getContext: () => ({ setTransform: noop }),
      remove(): void {
        node._parent?._remove(node);
      },
    };
    return node as unknown as HTMLCanvasElement;
  };
  const children: unknown[] = [];
  const body = {
    children,
    appendChild(node: { _parent: unknown }): void {
      children.push(node);
      node._parent = body;
    },
    _remove(node: unknown): void {
      const i = children.indexOf(node);
      if (i >= 0) children.splice(i, 1);
    },
  };
  (globalThis as Record<string, unknown>).window = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    scrollY: 0,
    addEventListener: noop,
    removeEventListener: noop,
  };
  (globalThis as Record<string, unknown>).document = {
    body,
    documentElement: { scrollHeight: 2000 },
    createElement: () => makeCanvas(),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    hidden: false,
  };
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1; // never invoke the frame
  (globalThis as Record<string, unknown>).cancelAnimationFrame = noop;
  return { body, makeCanvas };
}

test('re-exports the imperative surface', () => {
  assert.equal(typeof createField, 'function');
  assert.equal(typeof mountField, 'function');
  assert.equal(typeof ForcesField, 'function');
});

test('mountField appends a managed canvas and destroy() removes it', () => {
  const { body } = installDOM();
  assert.equal(body.children.length, 0);
  const field = mountField({ render: 'dots' });
  assert.equal(body.children.length, 1);
  field.destroy();
  assert.equal(body.children.length, 0);
});

test('new ForcesField() manages its canvas and forwards the full handle', () => {
  const { body } = installDOM();
  const field = new ForcesField({ accent: '#4da3ff' });
  assert.equal(body.children.length, 1);
  assert.equal(field.canvas, body.children[0]);
  const methods = [
    'scan',
    'rescan',
    'setAccent',
    'setPalette',
    'setFormation',
    'setAttention',
    'setCausality',
    'setRender',
    'threads',
    'burst',
    'destroy',
  ] as const;
  for (const m of methods) {
    assert.equal(typeof (field as unknown as Record<string, unknown>)[m], 'function', m);
  }
  field.destroy();
  assert.equal(body.children.length, 0);
});

test('ForcesField drives a canvas you own without creating or removing one', () => {
  const { body, makeCanvas } = installDOM();
  const own = makeCanvas();
  const field = new ForcesField({ canvas: own });
  assert.equal(body.children.length, 0); // we did not append it
  assert.equal(field.canvas, own);
  field.destroy();
  assert.equal(body.children.length, 0); // and we removed nothing
});
