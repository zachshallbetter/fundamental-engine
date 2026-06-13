import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * A zero-dependency DOM stub — enough surface for the underlying `createBrowserField` to
 * construct and tear down. No animation frame ever fires (the fake rAF never invokes its
 * callback), so only the synchronous mount path and cleanup are exercised. Mirrors the
 * pattern in packages/vanilla/src/field.test.ts.
 */
type StubCanvas = HTMLCanvasElement & { getContextCalls: number };

function installDOM(): { body: { children: unknown[] }; makeCanvas: () => StubCanvas } {
  const noop = (): void => {};
  const makeCanvas = (): StubCanvas => {
    const node = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      _parent: null as { _remove(n: unknown): void } | null,
      setAttribute: noop,
      getContextCalls: 0,
      getContext: () => {
        node.getContextCalls++;
        return { setTransform: noop, clearRect: noop, fillRect: noop };
      },
      remove(): void {
        node._parent?._remove(node);
      },
    };
    return node as unknown as StubCanvas;
  };
  const children: unknown[] = [];
  const body = {
    children,
    appendChild(node: { _parent: unknown }): void {
      children.push(node);
      (node as { _parent: unknown })._parent = body;
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
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1; // never invoke
  (globalThis as Record<string, unknown>).cancelAnimationFrame = noop;
  return { body, makeCanvas };
}

// ── module shape ─────────────────────────────────────────────────────────────
// Import from the built dist (`.tsx` isn't natively loadable by node --test;
// the build output is plain `.js`).

test('re-exports FieldField and useFieldField', async () => {
  const mod = await import('../dist/index.js');
  assert.equal(typeof mod.FieldField, 'function');
  assert.equal(typeof mod.useFieldField, 'function');
  // the deprecated Forces* aliases are gone
  assert.equal('ForcesField' in mod, false);
  assert.equal('useForcesField' in mod, false);
});

// ── overlay canvas wiring (via createBrowserField) ───────────────────────────
// useEffect never runs in this headless stub, so we exercise the canvas wiring
// directly through the platform entry point that the component delegates to.

test('createBrowserField accepts an overlayCanvas + overlay mode without throwing', async () => {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  const oc = makeCanvas();
  assert.doesNotThrow(() => {
    const h = createBrowserField(main, {
      render: 'dots',
      overlay: 'grid',
      overlayCanvas: oc,
    });
    h.destroy();
  });
});

test('createBrowserField accepts an overlay stack (array of modes) without throwing', async () => {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  const oc = makeCanvas();
  assert.doesNotThrow(() => {
    const h = createBrowserField(main, {
      overlay: ['grid', 'path'],
      overlayCanvas: oc,
    });
    h.destroy();
  });
});

test('overlay:"off" with overlayCanvas does not throw', async () => {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  const oc = makeCanvas();
  assert.doesNotThrow(() => {
    const h = createBrowserField(main, { overlay: 'off', overlayCanvas: oc });
    h.destroy();
  });
});

test('setOverlay() accepts all overlay modes without throwing (Field Surfaces)', async () => {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  const oc = makeCanvas();
  const h = createBrowserField(main, { overlay: 'off', overlayCanvas: oc });
  const modes = [
    'streamlines', 'force-vectors', 'field-lines', 'grid',
    'temperature', 'energy', 'path', 'data', 'off',
  ] as const;
  for (const mode of modes) {
    assert.doesNotThrow(() => h.setOverlay(mode), `setOverlay('${mode}')`);
  }
  h.destroy();
});

test('setOverlay() accepts an additive stack of readings without throwing', async () => {
  const { makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  const oc = makeCanvas();
  const h = createBrowserField(main, { overlayCanvas: oc });
  assert.doesNotThrow(() => h.setOverlay(['grid', 'path']), 'two readings stack');
  assert.doesNotThrow(() => h.setOverlay(['streamlines', 'temperature', 'data']), 'three readings stack');
  assert.doesNotThrow(() => h.setOverlay([]), 'empty stack clears');
  h.destroy();
});

test('overlay canvas is removable after field destroy (cleanup invariant)', async () => {
  const { body, makeCanvas } = installDOM();
  const { createBrowserField } = await import('@fundamental-engine/platform');
  const main = makeCanvas();
  // simulate the component appending an overlay canvas to body before creating the field
  const oc = makeCanvas();
  body.appendChild(oc as unknown as Parameters<typeof body.appendChild>[0]);
  assert.equal(body.children.length, 1);
  const h = createBrowserField(main, { overlay: 'grid', overlayCanvas: oc });
  h.destroy();
  // the component removes the canvas on unmount; mimic that here
  oc.remove();
  assert.equal(body.children.length, 0);
});
