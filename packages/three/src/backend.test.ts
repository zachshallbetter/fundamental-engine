/**
 * `threeBackend` GPU-buffer hygiene: the overlay's line/triangle attributes are persistent,
 * growable `DynamicDrawUsage` buffers written in place every frame — NOT four fresh Float32Arrays
 * + BufferAttributes per overlay frame (which orphaned the prior GPU buffers for the GC and forced
 * a full re-upload). These tests pin the reuse-in-steady-state and grow-on-demand behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal `document`/canvas shim — the text() path builds a label `CanvasTexture` from an
// offscreen 2D canvas (`document.createElement('canvas').getContext('2d')`). `node --test` has no
// DOM, so we provide the thinnest 2D context that satisfies the metric + fill calls. Must be set
// before importing the backend (measureText caches its metrics context at construction). The
// line/rect tests below don't touch it. Each stub canvas has its own width/height so CanvasTexture
// is happy.
const noop = (): void => {};
const g = globalThis as unknown as Record<string, unknown>;
g.document ??= {
  createElement: (): unknown => ({
    width: 1,
    height: 1,
    getContext: (): unknown => ({
      font: '',
      textBaseline: '',
      textAlign: '',
      fillStyle: '',
      scale: noop,
      fillText: noop,
      // width ~= 6px/char, enough to size a plate/sprite deterministically in the test
      measureText: (s: string): { width: number } => ({ width: s.length * 6 }),
    }),
    style: {},
    setAttribute: noop,
  }),
};

import { DynamicDrawUsage, Sprite, type BufferAttribute, type BufferGeometry, type LineSegments, type Group, type SpriteMaterial } from 'three';
import { threeBackend } from './backend.ts';
import { PlaneProjection } from './project.ts';

const stroke = { r: 255, g: 255, b: 255, alpha: 1 };
const lineGeomOf = (b: ReturnType<typeof threeBackend>): BufferGeometry =>
  (b.object.children[0] as LineSegments).geometry;

test('flush reuses the same position BufferAttribute across frames (no per-frame realloc)', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const geom = lineGeomOf(backend);

  backend.segments([0, 0, 10, 10, 20, 20, 30, 30], stroke); // two segments
  backend.clear(); // clear() finalizes the frame then resets the accumulators
  const attr1 = geom.getAttribute('position');
  assert.ok(geom.drawRange.count > 0, 'frame 1 drew something');
  assert.equal((attr1 as BufferAttribute).usage, DynamicDrawUsage, 'buffer marked dynamic');

  backend.segments([0, 0, 5, 5], stroke); // fewer segments → must reuse the existing buffer
  backend.clear();
  const attr2 = geom.getAttribute('position');
  assert.equal(attr2, attr1, 'same attribute object reused — no orphaned GPU buffer');
  assert.equal(geom.drawRange.count, 2, 'draw range bounds the live segment, ignoring the stale tail');
});

test('flush grows the buffer only when a frame needs more room', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const geom = lineGeomOf(backend);

  backend.segments([0, 0, 1, 1], stroke);
  backend.clear();
  const small = geom.getAttribute('position');

  const big: number[] = [];
  for (let i = 0; i < 400; i++) big.push(i, i, i + 1, i + 1); // 400 segments → 2400 floats
  backend.segments(big, stroke);
  backend.clear();
  const grown = geom.getAttribute('position');

  assert.notEqual(grown, small, 'buffer reallocated to fit the larger frame');
  assert.equal((grown as BufferAttribute).usage, DynamicDrawUsage, 'grown buffer stays dynamic');
  assert.ok((grown.array as Float32Array).length >= 2400, 'capacity covers the larger frame');
  assert.equal(geom.drawRange.count, 800, 'draw range = 2400 floats / 3');
});

const labelGroupOf = (b: ReturnType<typeof threeBackend>): Group => b.object.children[2] as Group;
const visibleSprites = (grp: Group): Sprite[] => grp.children.filter((c): c is Sprite => c instanceof Sprite && c.visible);

test('text() adds a visible label sprite carrying a texture, positioned on the overlay plane', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }), z: 0.02 });
  const labels = labelGroupOf(backend);

  backend.text('42', 100, 200, 255, 255, 255, 1);
  const shown = visibleSprites(labels);
  assert.equal(shown.length, 1, 'one label sprite is shown for one text() call');
  const mat = shown[0]!.material as SpriteMaterial;
  assert.ok(mat.map, 'the sprite carries a CanvasTexture');
  assert.equal(shown[0]!.position.z, 0.02, 'sprite sits on the overlay plane z');
  assert.ok(shown[0]!.scale.x > 0 && shown[0]!.scale.y > 0, 'sprite is sized to the label footprint');
});

test('clear() hides unused label sprites and the pool + textures are reused across frames', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const labels = labelGroupOf(backend);

  // frame 1: two labels
  backend.text('42', 10, 10, 255, 0, 0, 1);
  backend.text('7', 20, 20, 255, 0, 0, 1);
  backend.clear();
  assert.equal(visibleSprites(labels).length, 2, 'frame 1 shows two labels');
  const spriteA = labels.children[0] as Sprite;
  const texA = (spriteA.material as SpriteMaterial).map;
  const poolSize = labels.children.length;

  // frame 2: one label with the SAME string+color as before → texture cache hit, pooled sprite reused
  backend.text('42', 10, 10, 255, 0, 0, 1);
  backend.clear();
  const shown = visibleSprites(labels);
  assert.equal(shown.length, 1, 'frame 2 shows one label; the second sprite is hidden, not removed');
  assert.equal(labels.children.length, poolSize, 'sprite pool is reused (no new sprites created)');
  assert.equal((shown[0]!.material as SpriteMaterial).map, texA, 'the cached texture is reused for the repeated label');
});

test('dispose() releases the label sprite materials and cached textures', () => {
  const backend = threeBackend({ projection: new PlaneProjection({ width: 800, height: 600, scale: 0.01 }) });
  const labels = labelGroupOf(backend);

  backend.text('99', 5, 5, 0, 255, 0, 1);
  backend.clear();
  const sprite = labels.children[0] as Sprite;
  const tex = (sprite.material as SpriteMaterial).map!;
  let materialDisposed = false;
  let textureDisposed = false;
  sprite.material.addEventListener('dispose', () => { materialDisposed = true; });
  tex.addEventListener('dispose', () => { textureDisposed = true; });

  backend.dispose();
  assert.ok(materialDisposed, 'the sprite material was disposed');
  assert.ok(textureDisposed, 'the cached label texture was disposed');
});
