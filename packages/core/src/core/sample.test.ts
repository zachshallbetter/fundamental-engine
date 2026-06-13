/**
 * `FieldHandle.sample(x, y)` — the live-field read-out external visualizers consume (vector grids,
 * streamline tubes, mesh displacement). It returns the net force a still test particle would feel.
 *
 * The test also pins the **duck-typed virtual-element body path**: the engine builds a body from any
 * object implementing `getAttribute` / `hasAttribute` / `dataset` / `getBoundingClientRect` — no real
 * DOM — which is exactly how `@field-ui/three` registers a `THREE.Object3D` as a field body. So this
 * doubles as the contract test for meshes-as-bodies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

/** A non-DOM body element — the minimal shape the scanner + measure read. */
function virtualBody(attrs: Record<string, string>, rect: { x: number; y: number; w: number; h: number }) {
  return {
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    getBoundingClientRect: () => ({
      left: rect.x - rect.w / 2,
      top: rect.y - rect.h / 2,
      right: rect.x + rect.w / 2,
      bottom: rect.y + rect.h / 2,
      width: rect.w,
      height: rect.h,
      x: rect.x - rect.w / 2,
      y: rect.y - rect.h / 2,
      toJSON: () => ({}),
    }),
  };
}

function stubHost(bodyEls: unknown[]): FieldHost {
  const off = (): void => {};
  return {
    root: {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? bodyEls : []),
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 0,
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('sample returns ~zero with no bodies', () => {
  const field = createField({} as HTMLCanvasElement, { host: stubHost([]), render: 'none' });
  try {
    const f = field.sample(500, 400);
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), 'finite');
    assert.ok(Math.hypot(f.x, f.y) < 1e-6, 'an empty field exerts no force');
  } finally {
    field.destroy();
  }
});

test('sample reflects a registered (duck-typed) attract body — force points toward it', () => {
  // an attract well at the field centre (500, 400), built from a non-DOM element
  const body = virtualBody({ 'data-body': 'attract', 'data-strength': '1.6', 'data-range': '600' }, {
    x: 500,
    y: 400,
    w: 40,
    h: 40,
  });
  const field = createField({} as HTMLCanvasElement, { host: stubHost([body]), render: 'none' });
  try {
    field.scan(); // pick up + measure the virtual body

    // directly above the well → the pull is downward (+y, toward the body at y=400)
    const above = field.sample(500, 150);
    assert.ok(above.y > 0, `pull points down toward the well: ${above.y}`);
    assert.ok(Math.abs(above.x) < Math.abs(above.y), 'and is mostly vertical on the axis');

    // left of the well → the pull is rightward (+x, toward x=500)
    const left = field.sample(150, 400);
    assert.ok(left.x > 0, `pull points right toward the well: ${left.x}`);

    // far outside the range → negligible
    const far = field.sample(990, 790);
    assert.ok(Math.hypot(far.x, far.y) <= Math.hypot(above.x, above.y), 'weaker with distance/out of range');
  } finally {
    field.destroy();
  }
});
